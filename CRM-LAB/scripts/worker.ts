import { syncOnce } from '../src/lib/sync';
import { pool } from '../src/lib/db';
let stopped=false;
process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
console.log('Trabajador CRM-LAB iniciado.');
while(!stopped) {
  try {await syncOnce();}catch {console.error('No se pudo completar el ciclo de sincronización.');}
  if(process.argv.includes('--once'))break;
  for(let n=0;n<55+Math.floor(Math.random()*10)&&!stopped;n++)await new Promise(resolve=>setTimeout(resolve,1000));
}
await pool.end();
