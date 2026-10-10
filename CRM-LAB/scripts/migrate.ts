import { readFile } from 'node:fs/promises';
import { pool, transaction } from '../src/lib/db';
try {
  await transaction(async c => {
    await c.query('SELECT pg_advisory_xact_lock(7249001)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const name = '001-initial';
    if (!(await c.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount) {
      await c.query(await readFile(new URL('../migrations/001-initial.sql',import.meta.url),'utf8'));
      await c.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
    }
  });
  console.log('Migraciones aplicadas.');
} finally { await pool.end(); }
