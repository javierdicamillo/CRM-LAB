import { z } from 'zod';
import { hashPassword } from 'better-auth/crypto';
import { actor,sameOrigin,jsonBody,failure,ApiError } from '@/lib/security';
import { transaction,audit } from '@/lib/db';
import { agencySchema } from '@/lib/validation';
import { createUser } from '@/lib/users';
export async function POST(request:Request) {
  try {
    sameOrigin(request);const user=await actor(request,true);const input=await jsonBody(request);
    await transaction(async c=>{
      await c.query('SELECT pg_advisory_xact_lock(7249003)');
      if(input.action==='create-user') {const id=await createUser(c,input.user);await audit(c,user.id,'user.created',id);}
      else if(input.action==='update-user') {
        const data=z.object({id:z.string().min(1),role:z.enum(['admin','agent']),active:z.boolean()}).strict().parse(input.user);
        if(data.id===user.id&&(!data.active||data.role!=='admin')) throw new ApiError(400,'No podés quitarte tu propio acceso de administrador.');
        await c.query('UPDATE staff SET role=$2,active=$3 WHERE user_id=$1',[data.id,data.role,data.active]);
        await c.query('DELETE FROM session WHERE "userId"=$1',[data.id]);await audit(c,user.id,'user.updated',data.id);
      } else if(input.action==='reset-password') {
        const data=z.object({id:z.string().min(1),password:z.string().min(12).max(128)}).strict().parse(input.user);
        await c.query('UPDATE account SET password=$2,"updatedAt"=now() WHERE "userId"=$1 AND "providerId"=\'credential\'',[data.id,await hashPassword(data.password)]);
        await c.query('DELETE FROM session WHERE "userId"=$1',[data.id]);await audit(c,user.id,'user.password_reset',data.id);
      } else if(input.action==='settings') {
        const data=agencySchema.parse(input.data);await c.query('UPDATE settings SET data=$1 WHERE id=1',[JSON.stringify(data)]);await audit(c,user.id,'agency.updated');
      } else if(input.action==='retry') {
        // Conflictos de revision se resuelven manualmente; no reactivar una copia antigua.
        await c.query("UPDATE outbox SET next_at=now() WHERE state='pending'");await audit(c,user.id,'sync.retry');
      } else throw new ApiError(400,'Acción desconocida.');
    });
    return Response.json({ok:true});
  }catch(error){return failure(error);}
}
