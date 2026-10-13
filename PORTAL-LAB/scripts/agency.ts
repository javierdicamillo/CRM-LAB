import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { query, database } from "../src/lib/db";
import { hash, instanceId } from "../src/lib/http";
const command = process.argv[2],
  slug = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80)
    .parse(process.argv[3]);
if (command === "create") {
  const name = z
      .string()
      .min(1)
      .max(180)
      .parse(process.argv.slice(4).join(" ")),
    token = randomBytes(32).toString("base64url");
  const email = z
      .union([z.email(), z.literal("")])
      .parse(process.env.AGENCY_EMAIL ?? ""),
    phone = z
      .string()
      .max(40)
      .parse(process.env.AGENCY_PHONE ?? "");
  await query(
    "INSERT INTO agencies(id,slug,name,email,phone,token_hash) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), slug, name, email, phone, hash(token)],
  );
  console.log(
    "Guardá esta credencial en el archivo privado app.env de su CRM. No volverá a mostrarse.",
  );
  console.log(
    `PORTAL_TOKEN=${token}\nPORTAL_INSTANCE_ID=${await instanceId()}`,
  );
} else if (command === "suspend") {
  await query("UPDATE agencies SET active=false WHERE slug=$1", [slug]);
  console.log("Conexión suspendida.");
} else if (command === "rotate") {
  const token = randomBytes(32).toString("base64url");
  const rows = await query(
    "UPDATE agencies SET token_hash=$2 WHERE slug=$1 RETURNING id",
    [slug, hash(token)],
  );
  if (!rows.rows.length) throw new Error("Inmobiliaria inexistente.");
  console.log(`PORTAL_TOKEN=${token}`);
} else
  throw new Error(
    "Uso: npm run agency -- create slug Nombre | suspend slug | rotate slug",
  );
await (await database()).close();
