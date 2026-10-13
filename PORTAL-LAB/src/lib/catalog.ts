import { query, transaction } from "./db";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { body, failure, HttpError, json, limit, sameOrigin } from "./http";
export const visible =
  "l.status='published' AND a.active AND a.lease_expires_at>now()";
export async function catalog(params: {
  q?: string;
  operation?: string;
  type?: string;
  agency?: string;
  page?: string;
}) {
  const page = Math.max(1, Math.min(10000, Number(params.page) || 1)) | 0;
  const values = [
    `%${(params.q ?? "").slice(0, 100).replace(/[\\%_]/g, "\\$&")}%`,
    params.operation ?? "",
    params.type ?? "",
    params.agency ?? "",
  ];
  const where = `${visible} AND (l.payload->'listing'->>'title' ILIKE $1 OR l.payload->'listing'->'location'->>'city' ILIKE $1 OR l.payload->'listing'->'location'->>'neighborhood' ILIKE $1)
    AND ($2='' OR l.payload->'listing'->>'operation'=$2) AND ($3='' OR l.payload->'listing'->>'property_type'=$3) AND ($4='' OR a.slug=$4)`;
  const count = Number(
    (
      await query(
        `SELECT count(*) FROM listings l JOIN agencies a ON a.id=l.agency_id WHERE ${where}`,
        values,
      )
    ).rows[0].count,
  );
  const rows = (
    await query(
      `SELECT l.id,l.payload->'listing' AS listing,l.parcel,a.name AS agency,a.slug FROM listings l JOIN agencies a ON a.id=l.agency_id WHERE ${where} ORDER BY l.updated_at DESC,l.id LIMIT 12 OFFSET $5`,
      [...values, (page - 1) * 12],
    )
  ).rows;
  return { rows, count, page, pages: Math.max(1, Math.ceil(count / 12)) };
}
export async function publicListing(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return (
    (
      await query(
        `SELECT l.id,l.payload->'listing' AS listing,l.parcel,a.name AS agency,a.slug,a.phone,a.email FROM listings l JOIN agencies a ON a.id=l.agency_id WHERE l.id=$1 AND ${visible}`,
        [id],
      )
    ).rows[0] ?? null
  );
}
export async function mediaResponse(id: string) {
  try {
    z.uuid().parse(id);
    const row = (
      await query(
        `SELECT m.bytes FROM media m WHERE m.id=$1 AND EXISTS (SELECT 1 FROM listings l JOIN agencies a ON a.id=l.agency_id WHERE ${visible} AND l.agency_id=m.agency_id AND l.payload->'listing'->'media_ids' ? m.id::text)`,
        [id],
      )
    ).rows[0];
    if (!row) throw new HttpError(404, "Imagen no disponible.");
    return new Response(new Uint8Array(row.bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function submitInquiry(request: Request) {
  try {
    sameOrigin(request);
    if (
      process.env.NODE_ENV === "production" &&
      !z.email().safeParse(process.env.PORTAL_CONTACT_EMAIL).success
    )
      throw new HttpError(
        503,
        "Las consultas aún no están habilitadas en este portal.",
      );
    // Caddy replaces X-Real-IP. Do not expose the app port directly in production.
    await limit(`inquiry:${request.headers.get("x-real-ip") ?? "local"}`, 10);
    const input = z
      .object({
        listingId: z.uuid(),
        name: z.string().trim().min(1).max(150),
        email: z.union([z.email(), z.literal("")]),
        phone: z.string().trim().max(40),
        message: z.string().trim().min(1).max(5000),
        consent: z.literal(true),
        website: z.literal("").optional(),
      })
      .strict()
      .refine((v) => !!(v.email || v.phone))
      .parse(await body(request));
    await transaction(async (c) => {
      const row = (
        await c.query(
          `SELECT l.source_id,l.agency_id FROM listings l JOIN agencies a ON a.id=l.agency_id WHERE l.id=$1 AND ${visible} FOR SHARE OF l,a`,
          [input.listingId],
        )
      ).rows[0];
      if (!row)
        throw new HttpError(404, "La publicación ya no está disponible.");
      await c.query(
        "INSERT INTO inquiries(id,agency_id,listing_id,source_id,contact,message) VALUES($1,$2,$3,$4,$5,$6)",
        [
          randomUUID(),
          row.agency_id,
          input.listingId,
          row.source_id,
          JSON.stringify({
            name: input.name,
            ...(input.email ? { email: input.email } : {}),
            ...(input.phone ? { phone: input.phone } : {}),
          }),
          input.message,
        ],
      );
    });
    return json({ ok: true }, 201);
  } catch (error) {
    return failure(error);
  }
}

// Same public visibility rules as the catalog, without its twelve-item pagination.
export async function mapCatalog() {
  return (
    await query(`SELECT l.id,l.payload->'listing' AS listing,
    CASE WHEN l.payload->'listing'->'cadastre'->>'nomenclature'=l.parcel->>'nomenclature' THEN l.parcel ELSE NULL END AS parcel,
    a.name AS agency,a.slug FROM listings l JOIN agencies a ON a.id=l.agency_id
    WHERE ${visible} ORDER BY l.updated_at DESC,l.id`)
  ).rows;
}
