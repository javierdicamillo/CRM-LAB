import { randomUUID,createHash } from 'node:crypto';
import { mkdir,writeFile,unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { actor,sameOrigin,failure,ApiError,jsonBody,limited } from '@/lib/security';
import { transaction,audit } from '@/lib/db';
import { refreshProperty } from '@/lib/business';
export async function POST(request:Request) {
  let id:string|undefined;
  try {
    sameOrigin(request);const user=await actor(request);await limited(request,'photos',100);
    if(Number(request.headers.get('content-length')??0)>11000000) throw new ApiError(413,'La foto supera los 10 MB.');
    const form=await request.formData(),file=form.get('file'),propertyId=z.uuid().parse(form.get('propertyId'));
    if(!(file instanceof File)||file.size>10000000||file.size===0) throw new ApiError(400,'Elegí una imagen JPEG, PNG o WebP de hasta 10 MB.');
    const original=Buffer.from(await file.arrayBuffer());
    const image=sharp(original,{limitInputPixels:40000000,animated:false});
    const meta=await image.metadata();
    if(!['jpeg','png','webp'].includes(meta.format??'') || (meta.pages??1)>1) throw new ApiError(400,'Formato de imagen no admitido.');
    const bytes=await image.rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();
    id=randomUUID(); const folder=process.env.UPLOAD_DIR!;
    await mkdir(folder,{recursive:true,mode:0o700});
    await writeFile(path.join(folder,`${id}.webp`),bytes,{flag:'wx',mode:0o600});
    await writeFile(path.join(folder,`${id}.original`),original,{flag:'wx',mode:0o600});
    await transaction(async c=>{
      await c.query('SELECT pg_advisory_xact_lock(7249002)');
      if(!(await c.query("SELECT 1 FROM records WHERE id=$1 AND kind='property'",[propertyId])).rowCount) throw new ApiError(404,'Propiedad inexistente.');
      const count=Number((await c.query('SELECT count(*) FROM photos WHERE property_id=$1',[propertyId])).rows[0].count);
      if(count>=30) throw new ApiError(400,'Máximo 30 fotos por inmueble.');
      await c.query('INSERT INTO photos(id,property_id,name,sha256) VALUES($1,$2,$3,$4)',[id,propertyId,file.name.slice(0,180),createHash('sha256').update(bytes).digest('hex')]);
      await audit(c,user.id,'photo.uploaded',id);
    });
    return Response.json({id});
  }catch(error){
    if(id) for(const ext of ['webp','original']) await unlink(path.join(/* turbopackIgnore: true */process.env.UPLOAD_DIR!,`${id}.${ext}`)).catch(()=>{});
    return failure(error);
  }
}
export async function PATCH(request:Request) {
  try {sameOrigin(request);const user=await actor(request);const input=z.object({id:z.uuid(),approved:z.boolean()}).strict().parse(await jsonBody(request));
    await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(7249002)');const photo=(await c.query('UPDATE photos SET approved=$2 WHERE id=$1 RETURNING property_id',[input.id,input.approved])).rows[0];
      if(!photo)throw new ApiError(404,'Foto inexistente.');await refreshProperty(c,photo.property_id);await audit(c,user.id,'photo.approval_updated',input.id);});
    return Response.json({ok:true});
  }catch(error){return failure(error);}
}
