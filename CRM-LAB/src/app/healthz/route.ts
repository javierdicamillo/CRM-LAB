import { pool } from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){try{await pool.query('SELECT 1');return Response.json({status:'ok',version:'0.1.0'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503});}}
