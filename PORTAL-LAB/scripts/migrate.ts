import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { database, transaction } from "../src/lib/db";
export async function migrate() {
  const sql = await readFile(
    new URL("../migrations/001-initial.sql", import.meta.url),
    "utf8",
  );
  await transaction(async (c) => {
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await c.query(statement);
    await c.query(
      "INSERT INTO portal_settings(id,instance_id) VALUES(1,$1) ON CONFLICT DO NOTHING",
      [randomUUID()],
    );
  });
}
if (/migrate\.(ts|js)$/.test(process.argv[1] ?? "")) {
  await migrate();
  console.log("Migración PORTAL-LAB completada.");
  await (await database()).close();
}
