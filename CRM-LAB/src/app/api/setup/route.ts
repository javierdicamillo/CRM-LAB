import { pool, transaction, audit } from '@/lib/db';
import { failure, sameOrigin, limited, jsonBody, validToken, ApiError } from '@/lib/security';
import { userSchema } from '@/lib/validation';
import { createUser } from '@/lib/users';
export const dynamic='force-dynamic';
export async function GET(){ const result=await pool.query('SELECT 1 FROM staff LIMIT 1'); return Response.json({needed:result.rowCount===0},{headers:{'Cache-Control':'no-store'}}); }
export async function POST(request:Request) {
  try {
    sameOrigin(request); await limited(request,'bootstrap',10);
    const input=await jsonBody(request);
    if(!validToken(input.token,process.env.BOOTSTRAP_TOKEN)) throw new ApiError(403,'Enlace de activación inválido.');
    const user=userSchema.parse({...input.user,role:'admin'});
    if(process.env.BOOTSTRAP_EMAIL && user.email.toLowerCase()!==process.env.BOOTSTRAP_EMAIL.toLowerCase()) throw new ApiError(403,'Usá el correo reservado para activar esta instalación.');
    await transaction(async c=>{
      await c.query('SELECT pg_advisory_xact_lock(7249003)');
      if((await c.query('SELECT 1 FROM staff LIMIT 1')).rowCount) throw new ApiError(409,'La instalación ya fue activada.');
      const id=await createUser(c,user); await audit(c,id,'installation.activated');
    });
    return Response.json({ok:true});
  } catch(error){return failure(error);}
}
