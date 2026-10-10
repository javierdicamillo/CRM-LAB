import { actor,failure } from '@/lib/security';
import { pool, db, records } from '@/lib/db';
import { desc } from 'drizzle-orm';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  try {
    const user=await actor(request);
    const [items,staff,settings,photos,jobs,inbox,sync,audit]=await Promise.all([
      db.select().from(records).orderBy(desc(records.updatedAt)).limit(20000),
      pool.query('SELECT u.id,u.name,u.email,s.role,s.active FROM "user" u JOIN staff s ON s.user_id=u.id ORDER BY u.name'),
      pool.query('SELECT data FROM settings WHERE id=1'),pool.query('SELECT * FROM photos ORDER BY created_at'),
      pool.query('SELECT DISTINCT ON(offer_id) id,offer_id,revision,state,attempts,error,created_at,sent_at FROM outbox ORDER BY offer_id,revision DESC'),
      pool.query('SELECT * FROM inbox ORDER BY created_at DESC LIMIT 200'),pool.query('SELECT data FROM sync_state WHERE id=1'),
      user.role==='admin'?pool.query('SELECT * FROM audit ORDER BY id DESC LIMIT 80'):Promise.resolve({rows:[]})
    ]);
    return Response.json({user,records:items,staff:staff.rows,settings:settings.rows[0].data,photos:photos.rows,jobs:jobs.rows,inbox:inbox.rows,sync:{configured:!!(process.env.PORTAL_URL&&process.env.PORTAL_TOKEN&&process.env.PORTAL_INSTANCE_ID),...sync.rows[0].data},audit:audit.rows},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error);}
}
