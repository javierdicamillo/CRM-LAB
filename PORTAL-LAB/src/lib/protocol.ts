import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { query, transaction } from "./db";
import {
  agency,
  body,
  bytes,
  failure,
  hash,
  HttpError,
  instanceId,
  json,
} from "./http";
import { lookupParcel } from "../../../contracts/cadastre";

const uuid = z.uuid(),
  revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const short = z.string().max(180);
export const listingSchema = z
  .object({
    source_property_id: uuid,
    title: short.min(1),
    description: z.string().max(10000),
    operation: z.enum(["sale", "rent"]),
    property_type: z.enum([
      "apartment",
      "house",
      "land",
      "office",
      "store",
      "warehouse",
      "other",
    ]),
    price: z
      .object({
        amount: z
          .string()
          .max(30)
          .regex(/^[0-9]+(\.[0-9]{1,2})?$/),
        currency: z.string().regex(/^[A-Z]{3}$/),
        period: z.enum(["total", "month", "day"]),
      })
      .strict(),
    location: z
      .object({
        country_code: z.string().regex(/^[A-Z]{2}$/),
        region: short,
        city: short,
        neighborhood: short.optional(),
        public_address: short.optional(),
      })
      .strict(),
    area_m2: z.number().nonnegative().optional(),
    bedrooms: z.number().int().nonnegative().optional(),
    bathrooms: z.number().int().nonnegative().optional(),
    media_ids: z
      .array(uuid)
      .min(1)
      .max(30)
      .refine((v) => new Set(v).size === v.length),
    cadastre: z
      .object({
        province: z.literal("AR-Q"),
        nomenclature: z.string().regex(/^\d{15}$/),
      })
      .strict()
      .optional(),
  })
  .strict();
const updateSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("published"),
      revision,
      listing: listingSchema,
    })
    .strict(),
  z.object({ status: z.literal("withdrawn"), revision }).strict(),
]);
export type PublicListing = z.infer<typeof listingSchema>;
function paging(url: URL) {
  const size = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(url.searchParams.get("limit") ?? 100);
  const cursor = url.searchParams.get("cursor");
  if (cursor) uuid.parse(cursor);
  return { size, cursor };
}
function receipt(row: any) {
  return {
    source_listing_id: row.source_id,
    accepted_revision: Number(row.revision),
    status: row.status,
    public_listing_id: row.id,
  };
}
export async function protocol(request: Request) {
  try {
    const a = await agency(request),
      url = new URL(request.url),
      path = url.pathname,
      method = request.method;
    if (path === "/v1/capabilities" && method === "GET")
      return json({
        portal_instance_id: await instanceId(),
        protocol_versions: ["1.0", "1.1"],
        max_active_listings: 1000,
        max_image_bytes: 10000000,
        server_time: new Date().toISOString(),
      });
    if (path === "/v1/listings" && method === "GET") {
      const { size, cursor } = paging(url);
      const rows = (
        await query(
          "SELECT source_id,revision,status FROM listings WHERE agency_id=$1 AND ($2::uuid IS NULL OR source_id>$2) ORDER BY source_id LIMIT $3",
          [a.id, cursor, size + 1],
        )
      ).rows;
      return json({
        items: rows
          .slice(0, size)
          .map((r) => ({
            source_listing_id: r.source_id,
            revision: Number(r.revision),
            status: r.status,
          })),
        next_cursor: rows.length > size ? rows[size - 1].source_id : null,
      });
    }
    if (path === "/v1/media" && method === "POST") {
      const key = uuid.parse(request.headers.get("idempotency-key"));
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(
          request.headers.get("content-type") ?? "",
        )
      )
        throw new HttpError(422, "Formato de imagen no admitido.");
      const raw = await bytes(request, 10000000),
        originalHash = hash(raw);
      if (!raw.length) throw new HttpError(422, "Imagen vacía.");
      let converted: Buffer;
      try {
        const image = sharp(raw, {
            limitInputPixels: 25000000,
            animated: false,
          }),
          meta = await image.metadata();
        if (
          !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
          (meta.pages ?? 1) > 1
        )
          throw new Error();
        converted = await image
          .rotate()
          .resize({
            width: 1800,
            height: 1800,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer();
      } catch {
        throw new HttpError(
          422,
          "Imagen inválida o superior a 25 megapíxeles.",
        );
      }
      const result = await transaction(async (c) => {
        const live = (
          await c.query("SELECT active FROM agencies WHERE id=$1 FOR UPDATE", [
            a.id,
          ])
        ).rows[0];
        if (!live.active) throw new HttpError(403, "Conexión suspendida.");
        const existing = (
          await c.query(
            "SELECT id,original_hash,sha256 FROM media WHERE agency_id=$1 AND idempotency_key=$2",
            [a.id, key],
          )
        ).rows[0];
        if (existing) {
          if (existing.original_hash !== originalHash)
            throw new HttpError(
              409,
              "La clave de imagen ya tiene otro contenido.",
            );
          return { ...existing, created: false };
        }
        const usage = (
          await c.query(
            "SELECT count(*) AS count,coalesce(sum(octet_length(bytes)),0) AS size FROM media WHERE agency_id=$1",
            [a.id],
          )
        ).rows[0];
        if (
          Number(usage.count) >= 30000 ||
          Number(usage.size) + converted.length > 5000000000
        )
          throw new HttpError(413, "Cuota de imágenes alcanzada.");
        const id = randomUUID(),
          sha256 = hash(converted);
        await c.query(
          "INSERT INTO media(id,agency_id,idempotency_key,original_hash,sha256,bytes) VALUES($1,$2,$3,$4,$5,$6)",
          [id, a.id, key, originalHash, sha256, converted],
        );
        return { id, sha256, created: true };
      });
      return json(
        { media_id: result.id, sha256: result.sha256, state: "ready" },
        result.created ? 201 : 200,
      );
    }
    const listingMatch = path.match(/^\/v1\/listings\/([^/]+)$/);
    if (listingMatch && method === "PUT") {
      const sourceId = uuid.parse(listingMatch[1]),
        input = updateSchema.parse(await body(request));
      // Resolve only a voluntarily published reference. A failed lookup never invents a location.
      const existing = (
        await query(
          "SELECT parcel FROM listings WHERE agency_id=$1 AND source_id=$2",
          [a.id, sourceId],
        )
      ).rows[0];
      const nc =
        input.status === "published"
          ? input.listing.cadastre?.nomenclature
          : undefined;
      const parcel = nc
        ? existing?.parcel?.nomenclature === nc
          ? existing.parcel
          : await lookupParcel(nc)
        : null;
      const row = await transaction(async (c) => {
        const live = (
          await c.query("SELECT active FROM agencies WHERE id=$1 FOR UPDATE", [
            a.id,
          ])
        ).rows[0];
        if (!live.active) throw new HttpError(403, "Conexión suspendida.");
        const previous = (
          await c.query(
            "SELECT *,payload=$3::jsonb AS identical FROM listings WHERE agency_id=$1 AND source_id=$2 FOR UPDATE",
            [a.id, sourceId, JSON.stringify(input)],
          )
        ).rows[0];
        if (previous && Number(previous.revision) >= input.revision) {
          if (
            Number(previous.revision) === input.revision &&
            previous.identical
          )
            return previous;
          throw new HttpError(
            409,
            "Revisión antigua o contenido distinto para la misma revisión.",
          );
        }
        if (input.status === "published") {
          const count = (
            await c.query(
              "SELECT count(*) FROM media WHERE agency_id=$1 AND id=ANY($2::uuid[])",
              [a.id, input.listing.media_ids],
            )
          ).rows[0].count;
          if (Number(count) !== input.listing.media_ids.length)
            throw new HttpError(
              422,
              "Las fotos deben pertenecer a esta inmobiliaria.",
            );
          const active = (
            await c.query(
              "SELECT count(*) FROM listings WHERE agency_id=$1 AND status='published'",
              [a.id],
            )
          ).rows[0].count;
          if (previous?.status !== "published" && Number(active) >= 1000)
            throw new HttpError(
              422,
              "Límite de publicaciones activas alcanzado.",
            );
        }
        return (
          await c.query(
            `INSERT INTO listings(id,agency_id,source_id,revision,status,payload,parcel) VALUES($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT(agency_id,source_id) DO UPDATE SET revision=EXCLUDED.revision,status=EXCLUDED.status,payload=EXCLUDED.payload,parcel=EXCLUDED.parcel,updated_at=now() RETURNING *`,
            [
              randomUUID(),
              a.id,
              sourceId,
              input.revision,
              input.status,
              JSON.stringify(input),
              parcel ? JSON.stringify(parcel) : null,
            ],
          )
        ).rows[0];
      });
      return json(receipt(row));
    }
    if (path === "/v1/reconcile" && method === "POST") {
      const input = z
        .object({
          active_listings: z
            .array(z.object({ source_listing_id: uuid, revision }).strict())
            .max(1000)
            .refine(
              (v) =>
                new Set(v.map((x) => x.source_listing_id)).size === v.length,
            ),
        })
        .strict()
        .parse(await body(request));
      return json(
        await transaction(async (c) => {
          const live = (
            await c.query(
              "SELECT active,lease_expires_at FROM agencies WHERE id=$1 FOR UPDATE",
              [a.id],
            )
          ).rows[0];
          if (!live.active) throw new HttpError(403, "Conexión suspendida.");
          const rows = (
            await c.query(
              "SELECT source_id,revision FROM listings WHERE agency_id=$1 AND status='published'",
              [a.id],
            )
          ).rows;
          const manifest = new Map(
              input.active_listings.map((x) => [
                x.source_listing_id,
                x.revision,
              ]),
            ),
            conflicts = new Set<string>();
          for (const row of rows) {
            if (manifest.get(row.source_id) !== Number(row.revision))
              conflicts.add(row.source_id);
            manifest.delete(row.source_id);
          }
          for (const id of manifest.keys()) conflicts.add(id);
          let lease = live.lease_expires_at;
          if (!conflicts.size)
            lease = (
              await c.query(
                "UPDATE agencies SET lease_expires_at=now()+interval '72 hours' WHERE id=$1 RETURNING lease_expires_at",
                [a.id],
              )
            ).rows[0].lease_expires_at;
          return {
            matched: !conflicts.size,
            lease_expires_at: lease ? new Date(lease).toISOString() : null,
            conflicting_ids: [...conflicts],
          };
        }),
      );
    }
    if (path === "/v1/inquiries" && method === "GET") {
      const { size, cursor } = paging(url),
        delivered = url.searchParams.get("include_delivered") === "true";
      const rows = (
        await query(
          `SELECT * FROM inquiries WHERE agency_id=$1 AND ($2::uuid IS NULL OR id>$2)
        AND (acknowledged_at IS NULL OR ($3 AND acknowledged_at>now()-interval '7 days')) ORDER BY id LIMIT $4`,
          [a.id, cursor, delivered, size + 1],
        )
      ).rows;
      return json({
        portal_instance_id: await instanceId(),
        items: rows
          .slice(0, size)
          .map((r) => ({
            inquiry_id: r.id,
            source_listing_id: r.source_id,
            created_at: new Date(r.created_at).toISOString(),
            contact: r.contact,
            message: r.message,
            source: "PORTAL-LAB",
            delivery_status: r.acknowledged_at ? "delivered" : "pending",
          })),
        next_cursor: rows.length > size ? rows[size - 1].id : null,
      });
    }
    const ack = path.match(/^\/v1\/inquiries\/([^/]+)\/ack$/);
    if (ack && method === "POST") {
      const id = uuid.parse(ack[1]),
        input = z
          .object({ crm_inquiry_id: uuid })
          .strict()
          .parse(await body(request));
      return json(
        await transaction(async (c) => {
          const row = (
            await c.query(
              "SELECT * FROM inquiries WHERE id=$1 AND agency_id=$2 FOR UPDATE",
              [id, a.id],
            )
          ).rows[0];
          if (!row) throw new HttpError(404, "Consulta inexistente.");
          if (row.crm_inquiry_id && row.crm_inquiry_id !== input.crm_inquiry_id)
            throw new HttpError(409, "Confirmación incoherente.");
          const saved = (
            await c.query(
              "UPDATE inquiries SET crm_inquiry_id=$2,acknowledged_at=coalesce(acknowledged_at,now()) WHERE id=$1 RETURNING acknowledged_at",
              [id, input.crm_inquiry_id],
            )
          ).rows[0];
          return {
            inquiry_id: id,
            crm_inquiry_id: input.crm_inquiry_id,
            acknowledged_at: new Date(saved.acknowledged_at).toISOString(),
          };
        }),
      );
    }
    throw new HttpError(404, "Ruta inexistente.");
  } catch (error) {
    return failure(error);
  }
}
