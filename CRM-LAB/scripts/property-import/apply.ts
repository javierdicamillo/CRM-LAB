/** Manual agent tool. Dry-run is the default; never called by the web application. */
import {readFile,writeFile,rename,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {parseArgs} from 'node:util';
import {manifestSchema,sourceMarker} from './manifest';
import {importSourceUrl} from '../../src/lib/property-import';
const {values}=parseArgs({options:{manifest:{type:'string'},crm:{type:'string'},checkpoint:{type:'string'},apply:{type:'boolean',default:false}}});
if(!values.manifest)throw Error('Uso: npx tsx scripts/property-import/apply.ts --manifest archivo.json [--crm https://crm.example --checkpoint progreso.json --apply]');
const manifest=manifestSchema.parse(JSON.parse(await readFile(values.manifest,'utf8')));
console.log(JSON.stringify({mode:values.apply?'apply':'dry-run',properties:manifest.items.length,offers:manifest.items.reduce((n,x)=>n+x.offers.length,0),photos:manifest.items.reduce((n,x)=>n+x.photos.length,0)}));
if(!values.apply)process.exit(0);
if(!values.crm||!values.checkpoint||!process.env.CRM_EMAIL||!process.env.CRM_PASSWORD)throw Error('Se requieren --crm, --checkpoint, CRM_EMAIL y CRM_PASSWORD.');
const base=new URL(importSourceUrl(values.crm)).origin;
const lock=await open(values.checkpoint+'.lock','wx',0o600).catch(()=>{throw Error('Existe un bloqueo de importación. Verificar que no haya otro proceso antes de retirarlo.');});
const {unlink}=await import('node:fs/promises');
let cookie='';const report:{created:{properties:number;offers:number;photos:number};existingSkipped:number;completed:string[];error?:string}={created:{properties:0,offers:0,photos:0},existingSkipped:0,completed:[]};
async function checkpoint(){await writeFile(values.checkpoint!+'.tmp',JSON.stringify(report,null,2),{mode:0o600});await rename(values.checkpoint!+'.tmp',values.checkpoint!);}
async function request(path:string,data?:unknown){
 const form=data instanceof FormData;
 const r=await fetch(base+path,{method:data===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(!form&&data!==undefined?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:form?data:JSON.stringify(data)});
 if(!r.ok)throw Error(`${path}: HTTP ${r.status}. ${r.status===429?'Esperar 15 minutos antes de reanudar.':'Revisar el CRM y el checkpoint antes de reintentar.'}`);
 const cookies=r.headers.getSetCookie();if(cookies.length)cookie=cookies.map(x=>x.split(';')[0]).join('; ');
 return r.json();
}
async function photoBytes(url:string){
 const host=new URL(url).hostname;const addresses=await lookup(host,{all:true});
 // The manual importer must not turn a source image into a local-network request.
 if(!addresses.length||addresses.some(({address:a})=>/^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::|f[cd]|fe[89ab])/i.test(a)))throw Error('La imagen resuelve a una red no pública.');
 const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(45000)});if(!r.ok||!r.body)throw Error(`Foto: HTTP ${r.status}`);
 const chunks:Uint8Array[]=[];let size=0;
 const reader=r.body.getReader();
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>10000000)throw Error('Foto mayor a 10 MB.');chunks.push(value);}}finally{await reader.cancel();reader.releaseLock();}
 return Buffer.concat(chunks);
}
try {
 await request('/api/auth/sign-in/email',{email:process.env.CRM_EMAIL,password:process.env.CRM_PASSWORD});
 const state=await request('/api/state');const rows:any[]=state.records,photos:any[]=state.photos;
 for(const item of manifest.items){
  const marker=sourceMarker(item);const matches=rows.filter(r=>r.kind==='property'&&r.data.privateNotes?.split('\n').includes(marker));
  if(matches.length>1)throw Error('Origen duplicado en CRM: revisar manualmente.');
  let property=matches[0];
  if(!property){
   const data={...item.property,privateNotes:[item.property.privateNotes,marker,`Origen: ${item.source.url}`,`Referencia: ${item.source.reference}`].filter(Boolean).join('\n')};
   if(data.privateNotes.length>10000)throw Error('Notas demasiado extensas al agregar la referencia.');
   property=await request('/api/records',{kind:'property',data});rows.push(property);report.created.properties++;await checkpoint();
  }else report.existingSkipped++;
  for(const offer of item.offers){
   const existing=rows.filter(r=>r.kind==='offer'&&r.data.propertyId===property.id&&r.data.operation===offer.operation);
   if(existing.length>1)throw Error('Más de una oferta del mismo tipo: revisar manualmente.');
   if(existing.length){report.existingSkipped++;continue;}
   rows.push(await request('/api/records',{kind:'offer',data:{...offer,propertyId:property.id}}));report.created.offers++;await checkpoint();
  }
  // Sequential upload preserves the source order and the cover photo.
  for(const [index,url] of item.photos.entries()){
   const suffix=createHash('sha256').update(url).digest('hex').slice(0,20);const name=`import-${String(index+1).padStart(3,'0')}-${suffix}.img`;
   if(photos.some(p=>p.property_id===property.id&&p.name===name)){report.existingSkipped++;continue;}
   if(photos.filter(p=>p.property_id===property.id).length>=30)throw Error('Máximo de 30 fotos; preservar las restantes en el manifiesto.');
   const bytes=await photoBytes(url);const form=new FormData();form.set('propertyId',property.id);form.set('file',new Blob([new Uint8Array(bytes)]),name);
   const result=await request('/api/photos',form);photos.push({id:result.id,property_id:property.id,name});report.created.photos++;await checkpoint();
  }
  report.completed.push(marker);await checkpoint();
 }
 const final=await request('/api/state');
 for(const item of manifest.items){
  const p=final.records.find((r:any)=>r.kind==='property'&&r.data.privateNotes?.split('\n').includes(sourceMarker(item)));
  if(!p)throw Error('Verificación: falta un inmueble.');
  for(const offer of item.offers)if(!final.records.some((r:any)=>r.kind==='offer'&&r.data.propertyId===p.id&&r.data.operation===offer.operation))throw Error('Verificación: falta una oferta.');
  for(const [index,url] of item.photos.entries()){
   const name=`import-${String(index+1).padStart(3,'0')}-${createHash('sha256').update(url).digest('hex').slice(0,20)}.img`;
   if(!final.photos.some((photo:any)=>photo.property_id===p.id&&photo.name===name))throw Error('Verificación: falta una foto.');
  }
 }
 console.log('Importación verificada. Ofertas nuevas en borrador y fotos sin aprobar.');
}catch(error){report.error=error instanceof Error?error.message:'Importación incompleta';await checkpoint();throw error;}
finally{await lock.close();await unlink(values.checkpoint+'.lock');}
