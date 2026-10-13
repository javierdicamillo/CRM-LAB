import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
process.env.PORTAL_LOCAL_DB = "./.local-db";
process.env.PORTAL_ORIGIN = "http://127.0.0.1:3100";
Object.assign(process.env, { NODE_ENV: "development" });
const { migrate } = await import("./migrate");
const { query, database } = await import("../src/lib/db");
const { hash } = await import("../src/lib/http");
await migrate();
if (!Number((await query("SELECT count(*) FROM agencies")).rows[0].count)) {
  const a = randomUUID();
  await query(
    "INSERT INTO agencies(id,slug,name,token_hash,lease_expires_at) VALUES($1,'demo','Inmobiliaria de ejemplo',$2,now()+interval '72 hours')",
    [a, hash(randomUUID())],
  );
  const examples = [
    ["Casa para una nueva etapa", "house", "Neuquén", "sale", "185000"],
    ["Tu espacio cerca de todo", "apartment", "Neuquén", "rent", "850000"],
    ["El comienzo de un proyecto", "land", "Añelo", "sale", "42000"],
  ];
  for (let i = 0; i < examples.length; i++) {
    const [title, type, city, operation, amount] = examples[i],
      id = randomUUID(),
      source = randomUUID(),
      media = randomUUID();
    const bytes = await readFile(
      new URL(
        `../public/demo-architecture/${["house", "apartment", "land"][i]}.webp`,
        import.meta.url,
      ),
    );
    await query(
      "INSERT INTO media(id,agency_id,idempotency_key,original_hash,sha256,bytes) VALUES($1,$2,$3,$4,$4,$5)",
      [media, a, randomUUID(), hash(bytes), bytes],
    );
    const listing = {
      source_property_id: randomUUID(),
      title,
      description:
        "Propiedad ficticia para revisar la interfaz del portal. No representa una oferta comercial real.",
      operation,
      property_type: type,
      price: {
        amount,
        currency: operation === "rent" ? "ARS" : "USD",
        period: operation === "rent" ? "month" : "total",
      },
      location: {
        country_code: "AR",
        region: "Neuquén",
        city,
        neighborhood: "Demostración",
      },
      area_m2: [140, 65, 360][i],
      bedrooms: [3, 2, 0][i],
      bathrooms: [2, 1, 0][i],
      media_ids: [media],
    };
    await query(
      "INSERT INTO listings(id,agency_id,source_id,revision,status,payload) VALUES($1,$2,$3,1,'published',$4)",
      [
        id,
        a,
        source,
        JSON.stringify({ status: "published", revision: 1, listing }),
      ],
    );
  }
}
// Refresh only known fictional demo images; preserve user publications and parcel data.
const demoImages: Record<string, string> = {
  "Casa para una nueva etapa": "house",
  "Tu espacio cerca de todo": "apartment",
  "El comienzo de un proyecto": "land",
  "Parcela de ejemplo · El Cholar": "parcel",
};
const demoRows = (
  await query(
    "SELECT l.id,l.agency_id,l.payload->'listing' AS listing FROM listings l JOIN agencies a ON a.id=l.agency_id WHERE a.slug='demo'",
  )
).rows;
for (const { id, agency_id, listing } of demoRows) {
  const asset = demoImages[listing.title];
  if (!asset) continue;
  const bytes = await readFile(
    new URL(`../public/demo-architecture/${asset}.webp`, import.meta.url),
  );
  const digest = hash(bytes);
  let mediaId = (
    await query(
      "SELECT id FROM media WHERE agency_id=$1 AND sha256=$2 LIMIT 1",
      [agency_id, digest],
    )
  ).rows[0]?.id;
  if (!mediaId) {
    mediaId = randomUUID();
    await query(
      "INSERT INTO media(id,agency_id,idempotency_key,original_hash,sha256,bytes) VALUES($1,$2,$3,$4,$4,$5)",
      [mediaId, agency_id, randomUUID(), digest, bytes],
    );
  }
  await query(
    "UPDATE listings SET payload=jsonb_set(payload,'{listing,media_ids}',$1::jsonb) WHERE id=$2",
    [JSON.stringify([mediaId]), id],
  );
}
await query(
  "UPDATE agencies SET lease_expires_at=now()+interval '72 hours' WHERE slug='demo'",
);
await (await database()).close();
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  { env: process.env, stdio: "inherit" },
);
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", (code) => process.exit(code ?? 0));
