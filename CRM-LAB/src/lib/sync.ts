import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { pool,transaction } from './db';
import { importInquiry } from './business';
const indexEntry=z.object({source_listing_id:z.uuid(),revision:z.number().int().positive(),status:z.enum(['published','withdrawn'])});
const indexPage=z.object({items:z.array(indexEntry),next_cursor:z.string().nullable()});
const mediaReceipt=z.object({media_id:z.uuid(),sha256:z.string().regex(/^[a-f0-9]{64}$/),state:z.literal('ready')});
const receipt=z.object({source_listing_id:z.uuid(),accepted_revision:z.number().int().positive(),status:z.enum(['published','withdrawn']),public_listing_id:z.uuid()});
export class PortalError extends Error { constructor(public status:number,public retryAfter=0){super(`Portal respondió HTTP ${status}`);} }
export function retryDelay(attempt:number,random=Math.random()) {return Math.min(900,5*2**Math.min(attempt,8)*(0.8+random*0.4));}
function config() {
  const base=process.env.PORTAL_URL, token=process.env.PORTAL_TOKEN,instance=process.env.PORTAL_INSTANCE_ID;
  if(!base||!token||!instance)return null;
  const url=new URL(base);if(url.protocol!=='https:'&&process.env.NODE_ENV!=='test')throw new Error('PORTAL_URL requiere HTTPS.');
  if(url.username||url.password||url.search||url.hash)throw new Error('URL de portal inválida.');
  z.uuid().parse(instance);return {base:base.replace(/\/$/,''),token,instance};
}
async function portal(endpoint:string,init:RequestInit={}) {
  const conf=config()!;
  const response=await fetch(conf.base+endpoint,{...init,headers:{Authorization:`Bearer ${conf.token}`,...init.headers},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok) {
    const retry=response.headers.get('retry-after');
    const seconds=retry?(/^\d+$/.test(retry)?Number(retry):Math.max(0,(Date.parse(retry)-Date.now())/1000)):0;
    throw new PortalError(response.status,Number.isFinite(seconds)?Math.min(seconds,86400):0);
  }
  const text=await response.text();if(text.length>4000000)throw new Error('Respuesta del portal demasiado grande.');
  return JSON.parse(text);
}
async function status(data:Record<string,unknown>) {await pool.query('UPDATE sync_state SET data=data||$1::jsonb WHERE id=1',[JSON.stringify(data)]);}
async function negotiate() {
  const capabilities=z.object({portal_instance_id:z.uuid(),protocol_versions:z.array(z.string()),max_active_listings:z.number().int().positive()}).parse(await portal('/v1/capabilities'));
  if(capabilities.portal_instance_id!==config()!.instance)throw new Error('La identidad del portal no coincide con la configurada.');
  if(!capabilities.protocol_versions.some(v=>v==='v1'||v==='1'||v.startsWith('1.')))throw new Error('El portal no admite protocolo LAB v1.');
}
async function remoteIndex() {
  const entries:z.infer<typeof indexEntry>[]=[];let cursor:string|null=null;const seen=new Set<string>();
  for(let page=0;page<1000;page++) {
    const result=indexPage.parse(await portal('/v1/listings?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):'')));
    entries.push(...result.items);if(!result.next_cursor)return entries;
    if(seen.has(result.next_cursor))throw new Error('Cursor repetido del portal.');seen.add(result.next_cursor);cursor=result.next_cursor;
  }
  throw new Error('Demasiadas páginas del portal.');
}
async function safeReconcile() {
  const remote=await remoteIndex();
  const local=(await pool.query("SELECT id,revision,data FROM records WHERE kind='offer' AND revision>0")).rows;
  const byId=new Map(local.map(r=>[r.id,r]));
  for(const r of remote) {
    const l=byId.get(r.source_listing_id);
    if(!l||r.revision>l.revision||(r.revision===l.revision&&r.status!==l.data.publication)) {
      await status({paused:true,error:'Hay datos más recientes o desconocidos en el portal. Revisar una posible restauración antes de enviar.',conflictId:r.source_listing_id});
      return false;
    }
  }
  await transaction(async c=>{
    for(const l of local) {
      const r=remote.find(r=>r.source_listing_id===l.id);
      if(!r||r.revision<l.revision)await c.query("UPDATE outbox SET state='pending',next_at=now() WHERE offer_id=$1 AND revision=$2 AND state='sent'",[l.id,l.revision]);
    }
  });
  const manifest=local.filter(l=>l.data.publication==='published').map(l=>({source_listing_id:l.id,revision:l.revision}));
  if(manifest.length>1000)throw new Error('Límite de publicaciones excedido.');
  const receipt=z.object({matched:z.boolean(),lease_expires_at:z.string().nullable(),conflicting_ids:z.array(z.uuid())}).parse(await portal('/v1/reconcile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({active_listings:manifest})}));
  await status({lastReconcile:new Date().toISOString(),leaseExpiresAt:receipt.lease_expires_at,reconciled:receipt.matched});
  return true;
}
async function sendJob(job:any) {
  const snapshot=job.payload;
  let body:any={status:snapshot.status,revision:snapshot.revision};
  if(snapshot.status==='published') {
    const mediaIds:string[]=[];
    for(const id of snapshot.photo_ids) {
      z.uuid().parse(id);const bytes=await readFile(path.join(process.env.UPLOAD_DIR!,`${id}.webp`));
      const media=mediaReceipt.parse(await portal('/v1/media',{method:'POST',headers:{'Content-Type':'image/webp','Idempotency-Key':id},body:bytes}));
      mediaIds.push(media.media_id);
    }
    body.listing={...snapshot.listing,media_ids:mediaIds};
  }
  const accepted=receipt.parse(await portal(`/v1/listings/${job.offer_id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  if(accepted.accepted_revision!==job.revision||accepted.source_listing_id!==job.offer_id||accepted.status!==snapshot.status)throw new Error('Respuesta de publicación incoherente.');
  await pool.query("UPDATE outbox SET state='sent',sent_at=now(),error=null WHERE id=$1",[job.id]);
}
async function inquiries() {
  let cursor:string|null=null;const seen=new Set<string>();
  for(let page=0;page<1000;page++) {
    const response=z.object({portal_instance_id:z.uuid(),items:z.array(z.unknown()),next_cursor:z.string().nullable()}).parse(await portal('/v1/inquiries?limit=100&include_delivered=true'+(cursor?'&cursor='+encodeURIComponent(cursor):'')));
    if(response.portal_instance_id!==config()!.instance)throw new Error('Origen de consultas incorrecto.');
    for(const item of response.items) {
      const saved=await importInquiry(response.portal_instance_id,item);
      const inquiryId=(item as any).inquiry_id;
      const result=z.object({inquiry_id:z.uuid(),crm_inquiry_id:z.uuid()}).parse(await portal(`/v1/inquiries/${inquiryId}/ack`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crm_inquiry_id:saved.id})}));
      if(result.inquiry_id!==inquiryId||result.crm_inquiry_id!==saved.id)throw new Error('Confirmación de consulta incoherente.');
      await pool.query('UPDATE inbox SET acknowledged=true WHERE id=$1',[saved.id]);
    }
    if(!response.next_cursor)return;
    if(seen.has(response.next_cursor))throw new Error('Cursor de consultas repetido.');seen.add(response.next_cursor);cursor=response.next_cursor;
  }
  throw new Error('Demasiadas páginas de consultas.');
}
export async function syncOnce() {
  if(!config())return {configured:false};
  const lock=await pool.connect();
  if(!(await lock.query('SELECT pg_try_advisory_lock(7249004) AS locked')).rows[0].locked){lock.release();return;}
  try {
    await negotiate();
    const state=(await pool.query('SELECT data FROM sync_state WHERE id=1')).rows[0].data;
    if(state.paused)return;
    // Comprobar revisiones remotas antes de cualquier envío, también tras reiniciar/restaurar.
    if(!(await safeReconcile()))return;
    const jobs=(await pool.query("SELECT * FROM outbox WHERE state='pending' AND next_at<=now() ORDER BY created_at,revision LIMIT 30")).rows;
    const failedOffers=new Set<string>();
    for(const job of jobs) {
      if(failedOffers.has(job.offer_id))continue;
      try {await sendJob(job);}catch(error){
        failedOffers.add(job.offer_id);
        const permanent=error instanceof PortalError&&[400,403,404,409,413,422].includes(error.status);
        const delay=Math.max(retryDelay(job.attempts),error instanceof PortalError?error.retryAfter:0);
        await pool.query('UPDATE outbox SET state=$2,attempts=attempts+1,next_at=now()+($3*interval \'1 second\'),error=$4 WHERE id=$1',[job.id,permanent?'blocked':'pending',delay,error instanceof Error?error.message.slice(0,250):'Error de sincronización']);
        if(error instanceof PortalError&&error.status===409){await status({paused:true,error:'Conflicto de revisión. Sincronización pausada para proteger los datos.'});return;}
      }
    }
    await inquiries();await safeReconcile();await status({lastSuccess:new Date().toISOString(),error:null});
    await pool.query('DELETE FROM request_limits WHERE expires_at<now()');
    return {configured:true};
  }catch(error){await status({lastAttempt:new Date().toISOString(),error:error instanceof Error?error.message.slice(0,250):'Portal no disponible'});}
  finally{await lock.query('SELECT pg_advisory_unlock(7249004)');lock.release();}
}
