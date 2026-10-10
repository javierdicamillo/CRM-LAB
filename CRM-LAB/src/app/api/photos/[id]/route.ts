import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { actor,failure } from '@/lib/security';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {await actor(request);const id=z.uuid().parse((await params).id);const bytes=await readFile(path.join(process.env.UPLOAD_DIR!,`${id}.webp`));
    return new Response(bytes,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){if((error as any).code==='ENOENT')return new Response(null,{status:404});return failure(error);}
}
