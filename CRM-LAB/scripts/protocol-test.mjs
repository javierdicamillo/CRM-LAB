// Simulador de contrato: nunca publica en un portal externo.
import http from 'node:http';
import { randomUUID,createHash,randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
if(process.env.TARGET_DATABASE!=='crm_lab_test')throw new Error('Solo crm_lab_test');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
const instance=randomUUID(),token=randomBytes(24).toString('hex'),media=new Map(),listings=new Map();
let failMedia=true,acks=0,receivedInquiry=false;
const offer=(await db.query("SELECT * FROM records WHERE kind='offer' LIMIT 1")).rows[0];
if(!offer)throw new Error('Ejecutar primero integration.mjs');
// Recuperar el snapshot publicado que la prueba HTTP conservó como superseded.
const original=(await db.query("SELECT * FROM outbox WHERE offer_id=$1 AND payload->>'status'='published' ORDER BY revision DESC LIMIT 1",[offer.id])).rows[0];
const revision=offer.revision+1;const payload={...original.payload,revision};
await db.query("UPDATE outbox SET state='superseded' WHERE offer_id=$1",[offer.id]);
await db.query("UPDATE records SET revision=$2,data=data||'{\"publication\":\"published\"}'::jsonb WHERE id=$1",[offer.id,revision]);
const jobId=randomUUID();await db.query('INSERT INTO outbox(id,offer_id,revision,payload) VALUES($1,$2,$3,$4)',[jobId,offer.id,revision,JSON.stringify(payload)]);
const inquiry={inquiry_id:randomUUID(),source_listing_id:offer.id,created_at:new Date().toISOString(),contact:{name:'Consulta de simulador',email:'simulador@example.invalid'},message:'Consulta repetida para verificar ACK.',source:'PORTAL-LAB',delivery_status:'pending'};
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401).end('{}');return;}
  const url=new URL(req.url,'http://localhost');let body=Buffer.alloc(0);for await(const part of req)body=Buffer.concat([body,part]);
  const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(value));};
  if(url.pathname==='/v1/capabilities')return send({portal_instance_id:instance,protocol_versions:['1.0'],max_active_listings:1000});
  if(url.pathname==='/v1/listings'&&req.method==='GET')return send({items:[...listings.values()].map(l=>({source_listing_id:l.id,revision:l.revision,status:l.status})),next_cursor:null});
  if(url.pathname==='/v1/media'){
   if(failMedia){failMedia=false;res.writeHead(429,{'Retry-After':'1'}).end('{}');return;}
   const key=req.headers['idempotency-key'];if(!media.has(key))media.set(key,{media_id:randomUUID(),sha256:createHash('sha256').update(body).digest('hex'),state:'ready'});return send(media.get(key));
  }
  if(url.pathname.startsWith('/v1/listings/')&&req.method==='PUT'){
   const value=JSON.parse(body),id=url.pathname.split('/').pop();
   assert.ok(!body.toString().includes('privateAddress'));assert.ok(!body.toString().includes('privateNotes'));assert.ok(!body.toString().includes('ownerId'));
   if(listings.get(id)?.revision>value.revision)return send({},409);
   listings.set(id,{id,...value});return send({source_listing_id:id,accepted_revision:value.revision,status:value.status,public_listing_id:randomUUID()});
  }
  if(url.pathname==='/v1/reconcile'){const manifest=JSON.parse(body).active_listings;return send({matched:manifest.every(l=>listings.get(l.source_listing_id)?.revision===l.revision),lease_expires_at:new Date(Date.now()+72*3600000).toISOString(),conflicting_ids:[]});}
  if(url.pathname==='/v1/inquiries')return send({portal_instance_id:instance,items:receivedInquiry?[inquiry]:[],next_cursor:null});
  if(url.pathname.endsWith('/ack')){acks++;return send({inquiry_id:inquiry.inquiry_id,crm_inquiry_id:JSON.parse(body).crm_inquiry_id,acknowledged_at:new Date().toISOString()});}
  send({},404);
 }catch(e){res.writeHead(500).end(JSON.stringify({error:e.message}));}
});
await new Promise(resolve=>server.listen(4400,'127.0.0.1',resolve));
async function cycle(){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['dist/worker.mjs','--once'],{env:{...process.env,NODE_ENV:'test',PORTAL_URL:'http://127.0.0.1:4400',PORTAL_TOKEN:token,PORTAL_INSTANCE_ID:instance},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',d=>errors+=d);child.on('exit',code=>code===0?resolve():reject(new Error(errors)));});}
try{
 await cycle();let job=(await db.query('SELECT * FROM outbox WHERE id=$1',[jobId])).rows[0];assert.equal(job.state,'pending');assert.equal(job.attempts,1);
 await db.query('UPDATE outbox SET next_at=now() WHERE id=$1',[jobId]);receivedInquiry=true;
 await cycle();job=(await db.query('SELECT * FROM outbox WHERE id=$1',[jobId])).rows[0];assert.equal(job.state,'sent');assert.equal(listings.get(offer.id).listing.media_ids.length,1);
 await cycle();assert.equal(Number((await db.query('SELECT count(*) FROM inbox WHERE portal_id=$1 AND inquiry_id=$2',[instance,inquiry.inquiry_id])).rows[0].count),1);assert.ok(acks>=2);
 listings.get(offer.id).revision+=10;await cycle();assert.equal((await db.query('SELECT data FROM sync_state WHERE id=1')).rows[0].data.paused,true);
 console.log('Protocolo: publicación, fotos, 429/reintento, deduplicación con ACK repetido y protección ante restauración antigua aprobados.');
}finally{server.close();await db.end();}
