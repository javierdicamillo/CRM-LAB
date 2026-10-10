import { auth } from '@/lib/auth';
import { limited, failure, sameOrigin } from '@/lib/security';
const allowed=new Set(['sign-in/email','sign-out','get-session','change-password']);
async function handler(request:Request) {
  try {
    const path=new URL(request.url).pathname.replace('/api/auth/','');
    if(!allowed.has(path)) return Response.json({error:'Ruta no disponible.'},{status:404});
    if(request.method==='POST') { sameOrigin(request); if(path==='sign-in/email') await limited(request,'login',25); }
    return await auth.handler(request);
  } catch(error){ return failure(error); }
}
export const GET=handler;
export const POST=handler;
