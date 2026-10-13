import { Pool } from "pg";
export type Connection = {
  query(
    text: string,
    params?: any[],
  ): Promise<{ rows: any[]; rowCount?: number | null }>;
};
type Database = Connection & {
  transaction<T>(fn: (c: Connection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};
const globalDb = globalThis as unknown as { portalDb?: Promise<Database> };
export function database(): Promise<Database> {
  return (globalDb.portalDb ??= (async () => {
    if (process.env.PORTAL_LOCAL_DB) {
      if (process.env.NODE_ENV === "production")
        throw new Error("La base local es solo para desarrollo y pruebas.");
      const { PGlite } = await import("@electric-sql/pglite");
      const db = new PGlite(
        process.env.PORTAL_LOCAL_DB === ":memory:"
          ? undefined
          : process.env.PORTAL_LOCAL_DB,
      );
      return {
        query: (sql, params) => db.query(sql, params),
        transaction: (fn) => db.transaction((c) => fn(c)),
        close: () => db.close(),
      } as Database;
    }
    if (!process.env.DATABASE_URL)
      throw new Error("Falta DATABASE_URL para PORTAL-LAB.");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
    return {
      query: (sql, params) => pool.query(sql, params),
      close: () => pool.end(),
      async transaction<T>(fn: (c: Connection) => Promise<T>) {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const value = await fn(c);
          await c.query("COMMIT");
          return value;
        } catch (error) {
          await c.query("ROLLBACK");
          throw error;
        } finally {
          c.release();
        }
      },
    };
  })());
}
export async function query(sql: string, params?: any[]) {
  return (await database()).query(sql, params);
}
export async function transaction<T>(fn: (c: Connection) => Promise<T>) {
  return (await database()).transaction(fn);
}
