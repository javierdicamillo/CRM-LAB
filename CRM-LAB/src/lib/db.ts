import { Pool, type PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, uuid, text, jsonb, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
const globalDb = globalThis as unknown as { crmPool?: Pool };
export const pool = globalDb.crmPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 5000 });
globalDb.crmPool = pool;
export const records = pgTable('records', {
  id: uuid().primaryKey(), kind: text().notNull(), data: jsonb().$type<Record<string, any>>().notNull(),
  version: integer().notNull(), revision: integer().notNull(), archived: boolean().notNull(),
  createdAt: timestamp('created_at',{withTimezone:true}).notNull(), updatedAt: timestamp('updated_at',{withTimezone:true}).notNull()
});
export const db = drizzle(pool);
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function audit(client: PoolClient, user: string | null, action: string, entity?: string) {
  await client.query('INSERT INTO audit(user_id,action,entity_id) VALUES($1,$2,$3)',[user,action,entity ?? null]);
}
