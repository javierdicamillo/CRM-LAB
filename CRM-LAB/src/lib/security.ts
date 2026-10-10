import { NextResponse } from 'next/server';
import { auth } from './auth';
import { pool } from './db';
import { createHash } from 'node:crypto';
import { ApiError } from './errors';
export { ApiError,validToken } from './errors';
export async function actor(request: Request, admin=false) {
  const session = await auth.api.getSession({headers:request.headers});
  if (!session) throw new ApiError(401,'Iniciá sesión para continuar.');
  const result=await pool.query('SELECT role,active FROM staff WHERE user_id=$1',[session.user.id]);
  const staff=result.rows[0];
  if (!staff?.active) throw new ApiError(403,'Tu acceso está deshabilitado.');
  if (admin && staff.role!=='admin') throw new ApiError(403,'Esta acción requiere un administrador.');
  return {...session.user,role:staff.role as 'admin'|'agent'};
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(process.env.BETTER_AUTH_URL!).origin) throw new ApiError(403,'Origen de solicitud no permitido.');
}
export async function limited(request:Request,scope:string,max=20) {
  const ip=request.headers.get('x-real-ip') ?? 'local';
  const key=createHash('sha256').update(`${scope}:${ip}`).digest('hex');
  const result=await pool.query(`INSERT INTO request_limits(key,hits,expires_at) VALUES($1,1,now()+interval '15 minutes')
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN request_limits.expires_at<now() THEN 1 ELSE request_limits.hits+1 END,
    expires_at=CASE WHEN request_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE request_limits.expires_at END RETURNING hits`,[key]);
  if(result.rows[0].hits>max) throw new ApiError(429,'Demasiados intentos. Volvé a intentar en 15 minutos.');
}
export async function jsonBody(request:Request,max=100000) {
  const body=await request.text(); if(Buffer.byteLength(body)>max) throw new ApiError(413,'Contenido demasiado grande.');
  try { return JSON.parse(body); } catch { throw new ApiError(400,'JSON inválido.'); }
}
export function failure(error:unknown) {
  if(error instanceof ApiError) return NextResponse.json({error:error.message},{status:error.status});
  if(error && typeof error==='object' && 'issues' in error) return NextResponse.json({error:'Revisá los campos ingresados.',details:(error as any).issues.map((i:any)=>`${i.path.join('.')}: ${i.message}`).slice(0,6)},{status:400});
  console.error('CRM request failed',error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({error:'No se pudo completar la operación. Volvé a intentarlo.'},{status:500});
}
