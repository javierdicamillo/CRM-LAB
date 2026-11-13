import { syncOnce } from '../src/lib/sync';
import { processWhatsAppQueue } from '../src/lib/whatsapp';
import { pool } from '../src/lib/db';
let stopped=false;
process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
console.log('Trabajador CRM-LAB iniciado.');
let nextSync=0;
while(!stopped) {
  if(Date.now()>=nextSync) {
    try {await syncOnce();}catch {console.error('No se pudo completar el ciclo de sincronización.');}
    nextSync=Date.now()+60000;
  }
  try {await processWhatsAppQueue();}catch(error){console.error('No se pudo procesar la cola de WhatsApp.',error instanceof Error?error.name:'unknown');}
  if(process.argv.includes('--once'))break;
  for(let n=0;n<3&&!stopped;n++)await new Promise(resolve=>setTimeout(resolve,1000));
}
await pool.end();
