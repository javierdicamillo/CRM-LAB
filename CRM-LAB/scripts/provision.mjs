import pg from 'pg';
import { readFile } from 'node:fs/promises';
const target=process.env.TARGET_DATABASE??'crm_lab';
if(!['crm_lab','crm_lab_test'].includes(target))throw new Error('Base no permitida');
const adminPassword=(await readFile(process.env.ADMIN_PASSWORD_FILE,'utf8')).trim();
const appPassword=(await readFile(process.env.APP_PASSWORD_FILE,'utf8')).trim();
const admin=new pg.Client({host:'db',database:'postgres',user:'postgres',password:adminPassword});await admin.connect();
if(!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='crm_app'")).rowCount){const sql=(await admin.query("SELECT format('CREATE ROLE crm_app LOGIN PASSWORD %L',$1::text) AS sql",[appPassword])).rows[0].sql;await admin.query(sql);}
if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rowCount)await admin.query(`CREATE DATABASE ${target}`);
await admin.end();
const db=new pg.Client({host:'db',database:target,user:'postgres',password:adminPassword});await db.connect();
try{
 await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(7249001)');
 await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
 if(!(await db.query("SELECT 1 FROM schema_migrations WHERE name='001-initial'")).rowCount){await db.query(await readFile(new URL('../migrations/001-initial.sql',import.meta.url),'utf8'));await db.query("INSERT INTO schema_migrations(name) VALUES('001-initial')");}
 await db.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
 await db.query('GRANT USAGE ON SCHEMA public TO crm_app');
 await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO crm_app');
 await db.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app');
 await db.query('REVOKE ALL ON schema_migrations FROM crm_app');
 if(process.env.AGENCY_NAME)await db.query("UPDATE settings SET data=jsonb_set(data,'{agencyName}',to_jsonb($1::text)) WHERE id=1",[process.env.AGENCY_NAME]);
 await db.query('COMMIT');console.log('Base preparada; rol de aplicación sin privilegios de administración.');
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
