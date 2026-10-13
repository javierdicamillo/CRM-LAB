import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ApiError } from './errors';
import { audit, transaction, pool } from './db';
import { lookupParcel, normalizeNomenclature, CadastreError } from '../../../contracts/cadastre';
import { schemas, type Kind, inquirySchema } from './validation';

export function publicListing(property:any,offer:any) {
  const p=property.data, o=offer.data;
  return {source_property_id:property.id,title:p.title,description:p.description,operation:o.operation,property_type:p.type,
    price:{amount:o.amount,currency:o.currency,period:o.period},
    location:{country_code:p.country,region:p.region,city:p.city,neighborhood:p.neighborhood,...(p.publicAddress?{public_address:p.publicAddress}:{})},
    area_m2:p.area,bedrooms:p.bedrooms,bathrooms:p.bathrooms,...(p.cadastralPublic && p.cadastre && p.cadastre.nomenclature===p.cadastralNumber ? {cadastre:{province:'AR-Q',nomenclature:p.cadastre.nomenclature}} : {})};
}
async function related(c:PoolClient,id:string,kind:string) {
  if(!id) return;
  if(!(await c.query('SELECT 1 FROM records WHERE id=$1 AND kind=$2',[id,kind])).rowCount) throw new ApiError(400,`La referencia de ${kind} no existe.`);
}
async function references(c:PoolClient,kind:Kind,data:any) {
  if(data.assigneeId && !(await c.query('SELECT 1 FROM staff WHERE user_id=$1 AND active',[data.assigneeId])).rowCount) throw new ApiError(400,'El responsable no está activo.');
  if(kind==='property') await related(c,data.ownerId,'contact');
  if(kind==='offer') await related(c,data.propertyId,'property');
  if(kind==='opportunity') { await related(c,data.contactId,'contact'); await related(c,data.offerId,'offer'); }
  if(kind==='activity') { await related(c,data.contactId,'contact'); await related(c,data.propertyId,'property'); await related(c,data.opportunityId,'opportunity'); }
}
export async function enqueue(c:PoolClient,offerId:string,status:'published'|'withdrawn') {
  const offer=(await c.query("SELECT * FROM records WHERE id=$1 AND kind='offer' FOR UPDATE",[offerId])).rows[0];
  if(!offer) throw new ApiError(404,'Oferta inexistente.');
  let payload:any={status,revision:offer.revision+1};
  if(status==='published') {
    const property=(await c.query('SELECT * FROM records WHERE id=$1',[offer.data.propertyId])).rows[0];
    if(!property || !['available','reserved'].includes(property.data.status)) throw new ApiError(400,'Solo se publican inmuebles disponibles o reservados.');
    const photos=(await c.query('SELECT id FROM photos WHERE property_id=$1 AND approved ORDER BY created_at,id',[property.id])).rows;
    if(!photos.length) throw new ApiError(400,'Aprobá al menos una foto para publicar.');
    const active=(await c.query("SELECT count(*) FROM records WHERE kind='offer' AND data->>'publication'='published'")).rows[0].count;
    if(offer.data.publication!=='published' && Number(active)>=1000) throw new ApiError(400,'Límite de 1.000 publicaciones activas.');
    payload={...payload,listing:publicListing(property,offer),photo_ids:photos.map(p=>p.id)};
  }
  await c.query("UPDATE records SET revision=revision+1,version=version+1,updated_at=now(),data=data||jsonb_build_object('publication',$2::text) WHERE id=$1",[offerId,status]);
  await c.query("UPDATE outbox SET state='superseded' WHERE offer_id=$1 AND state IN ('pending','blocked')",[offerId]);
  await c.query('INSERT INTO outbox(id,offer_id,revision,payload) VALUES($1,$2,$3,$4)',[randomUUID(),offerId,payload.revision,JSON.stringify(payload)]);
}
export async function refreshProperty(c:PoolClient,propertyId:string) {
  const property=(await c.query('SELECT data FROM records WHERE id=$1',[propertyId])).rows[0];
  const offers=(await c.query("SELECT id FROM records WHERE kind='offer' AND data->>'propertyId'=$1 AND data->>'publication'='published' ORDER BY id",[propertyId])).rows;
  const photos=(await c.query('SELECT count(*) FROM photos WHERE property_id=$1 AND approved',[propertyId])).rows[0];
  for(const offer of offers) await enqueue(c,offer.id,Number(photos.count)>0&&['available','reserved'].includes(property.data.status)?'published':'withdrawn');
}
export async function saveRecord(userId:string,kind:Kind,input:unknown,id?:string,version?:number) {
  const data=schemas[kind].parse(input) as any;
  if(kind==='property') {
    if(data.cadastralNumber) {
      if(data.country!=='AR'||data.region.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()!=='neuquen') throw new ApiError(400,'La vinculación catastral corresponde a propiedades de Neuquén, Argentina.');
      try {
        data.cadastralNumber=normalizeNomenclature(data.cadastralNumber);
        const previous=id?(await pool.query("SELECT data FROM records WHERE id=$1 AND kind='property'",[id])).rows[0]?.data:null;
        data.cadastre=previous?.cadastre?.nomenclature===data.cadastralNumber?previous.cadastre:await lookupParcel(data.cadastralNumber);
      } catch(error) {if(error instanceof CadastreError)throw new ApiError(error.status,error.message);throw error;}
    } else {data.cadastralPublic=false;}
  }
  return transaction(async c=>{
    // Serialize commercial writes with publication snapshots and restores.
    await c.query('SELECT pg_advisory_xact_lock(7249002)');
    await references(c,kind,data);
    let record;
    if(id) {
      const previous=(await c.query('SELECT * FROM records WHERE id=$1 AND kind=$2 FOR UPDATE',[id,kind])).rows[0];
      if(!previous) throw new ApiError(404,'Registro inexistente.');
      if(previous.version!==version) throw new ApiError(409,'Otra persona modificó este registro. Recargá antes de guardar.');
      if(kind==='offer') data.publication=previous.data.publication??'draft';
      record=(await c.query('UPDATE records SET data=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *',[id,JSON.stringify(data)])).rows[0];
    } else {
      if(kind==='offer') data.publication='draft';
      record=(await c.query('INSERT INTO records(id,kind,data) VALUES($1,$2,$3) RETURNING *',[randomUUID(),kind,JSON.stringify(data)])).rows[0];
    }
    if(kind==='property') await refreshProperty(c,record.id);
    if(kind==='offer' && data.publication==='published') await enqueue(c,record.id,'published');
    await audit(c,userId,id?'record.updated':'record.created',record.id);
    return record;
  });
}
export async function publish(userId:string,id:string,status:'published'|'withdrawn',version:number) {
  return transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(7249002)');
    const existing=(await c.query('SELECT version FROM records WHERE id=$1',[id])).rows[0];
    if(!existing) throw new ApiError(404,'Oferta inexistente.');
    if(existing.version!==version) throw new ApiError(409,'La oferta cambió. Recargá antes de publicar.');
    await enqueue(c,id,status); await audit(c,userId,`offer.${status}`,id);
  });
}
export async function importInquiry(portalId:string,input:unknown) {
  const item=inquirySchema.parse(input);
  return transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(7249002)');
    const existing=(await c.query('SELECT id FROM inbox WHERE portal_id=$1 AND inquiry_id=$2',[portalId,item.inquiry_id])).rows[0];
    if(existing) return {id:existing.id,duplicate:true};
    const offer=(await c.query("SELECT * FROM records WHERE id=$1 AND kind='offer'",[item.source_listing_id])).rows[0];
    if(!offer) throw new ApiError(409,'Consulta de una oferta desconocida: requiere revisión, no se confirma.');
    const property=(await c.query('SELECT * FROM records WHERE id=$1',[offer.data.propertyId])).rows[0];
    // Reutilizar solo si el correo identifica exactamente un contacto; nunca por nombre.
    // Consultas nuevas de la misma dirección se revisan antes de crear oportunidades adicionales.
    const email=item.contact.email?.toLowerCase();
    const matches=email?(await c.query("SELECT id FROM records WHERE kind='contact' AND lower(data->>'email')=$1",[email])).rows:[];
    const contactId=matches.length===1?matches[0].id:randomUUID();
    const assigneeId=property?.data.assigneeId??'';
    if(matches.length!==1) await c.query('INSERT INTO records(id,kind,data) VALUES($1,\'contact\',$2)',[contactId,JSON.stringify({name:item.contact.name,email:email??'',phone:item.contact.phone??'',type:'buyer',notes:'Consulta recibida de PORTAL-LAB.',assigneeId})]);
    // Registrar cada consulta como actividad; oportunidad existente por contacto/oferta se reutiliza.
    const opportunities=(await c.query("SELECT id FROM records WHERE kind='opportunity' AND data->>'contactId'=$1 AND data->>'offerId'=$2 AND data->>'stage' NOT IN ('won','lost') ORDER BY created_at LIMIT 1",[contactId,offer.id])).rows;
    const opportunityId=opportunities[0]?.id??randomUUID();
    if(!opportunities.length) await c.query('INSERT INTO records(id,kind,data) VALUES($1,\'opportunity\',$2)',[opportunityId,JSON.stringify({title:`Consulta: ${property.data.title}`,contactId,offerId:offer.id,stage:'new',amount:offer.data.amount,currency:offer.data.currency,assigneeId,notes:item.message})]);
    const id=randomUUID();
    await c.query('INSERT INTO inbox(id,portal_id,inquiry_id,payload,contact_id,opportunity_id) VALUES($1,$2,$3,$4,$5,$6)',[id,portalId,item.inquiry_id,JSON.stringify(item),contactId,opportunityId]);
    await c.query('INSERT INTO records(id,kind,data) VALUES($1,\'activity\',$2)',[randomUUID(),JSON.stringify({title:`Responder a ${item.contact.name}`,type:'call',dueAt:new Date().toISOString(),done:false,contactId,propertyId:property.id,opportunityId,assigneeId,notes:item.message})]);
    await audit(c,null,'inquiry.imported',id);
    return {id,duplicate:false};
  });
}
