import { actor,failure } from '@/lib/security';
import { pool,transaction,audit } from '@/lib/db';
import archiver from 'archiver';
import { PassThrough,Readable } from 'node:stream';
import path from 'node:path';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const user=await actor(request,true);
    const backup=await transaction(async c=>{
      await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const records=(await c.query('SELECT * FROM records ORDER BY created_at')).rows;
      const photos=(await c.query('SELECT * FROM photos')).rows;
      const inbox=(await c.query('SELECT * FROM inbox')).rows;
      const settings=(await c.query('SELECT data FROM settings WHERE id=1')).rows[0].data;
      await audit(c,user.id,'data.exported');return {format:'crm-lab-business-v1',exportedAt:new Date().toISOString(),records,photos,inbox,settings};
    });
    const format=new URL(request.url).searchParams.get('format');
    if(format==='csv') {
      const safe=(v:any)=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
      const rows=[['id','tipo','nombre','correo','telefono','ciudad','estado','moneda','importe'],...backup.records.map(r=>[r.id,r.kind,r.data.title??r.data.name,r.data.email,r.data.phone,r.data.city,r.data.stage??r.data.status,r.data.currency,r.data.amount])];
      return new Response('\ufeff'+rows.map(row=>row.map(safe).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="crm-lab.csv"','Cache-Control':'no-store'}});
    }
    if(format!=='zip')return Response.json(backup,{headers:{'Content-Disposition':'attachment; filename="crm-lab.json"','Cache-Control':'no-store'}});
    const archive=archiver('zip',{zlib:{level:1}}),stream=new PassThrough();
    archive.on('error',error=>stream.destroy(error));archive.on('warning',error=>stream.destroy(error));archive.pipe(stream);
    archive.append(JSON.stringify(backup,null,2),{name:'crm-lab.json'});
    for(const photo of backup.photos) for(const ext of ['webp','original']) archive.file(path.join(/* turbopackIgnore: true */process.env.UPLOAD_DIR!,`${photo.id}.${ext}`),{name:`photos/${photo.id}.${ext}`});
    void archive.finalize();
    return new Response(Readable.toWeb(stream) as ReadableStream,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="crm-lab.zip"','Cache-Control':'no-store'}});
  }catch(error){return failure(error);}
}
