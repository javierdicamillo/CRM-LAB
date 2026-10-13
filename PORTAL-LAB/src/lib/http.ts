import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { query } from "./db";
import { CadastreError } from "../../../contracts/cadastre";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  const status =
    error instanceof HttpError || error instanceof CadastreError
      ? error.status
      : error instanceof z.ZodError
        ? 422
        : 503;
  const message =
    error instanceof HttpError || error instanceof CadastreError
      ? error.message
      : error instanceof z.ZodError
        ? "Revisá los campos enviados."
        : "El servicio no está disponible temporalmente.";
  if (status === 503)
    console.error(
      "Portal request failed:",
      error instanceof Error ? error.name : "unknown",
    );
  return Response.json(
    { code: `http_${status}`, message, request_id: randomUUID() },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": "900" } : {}),
      },
    },
  );
}
export async function bytes(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new HttpError(413, "Contenido demasiado grande.");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.byteLength;
      if (size > max) throw new HttpError(413, "Contenido demasiado grande.");
      parts.push(r.value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(parts);
}
export async function body(request: Request) {
  const raw = await bytes(request, 200000);
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}
export async function limit(key: string, max: number) {
  const result = await query(
    `INSERT INTO request_limits(key,hits,expires_at) VALUES($1,1,now()+interval '15 minutes')
    ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN request_limits.expires_at<now() THEN 1 ELSE request_limits.hits+1 END,
    expires_at=CASE WHEN request_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE request_limits.expires_at END RETURNING hits`,
    [hash(key)],
  );
  if (result.rows[0].hits > max)
    throw new HttpError(
      429,
      "Demasiadas solicitudes. Intentá de nuevo en 15 minutos.",
    );
}
export async function agency(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{32,200})$/)?.[1];
  if (!token) throw new HttpError(401, "Credencial requerida.");
  const a = (
    await query("SELECT * FROM agencies WHERE token_hash=$1", [hash(token)])
  ).rows[0];
  if (!a) throw new HttpError(401, "Credencial inválida.");
  if (!a.active) throw new HttpError(403, "Conexión suspendida.");
  await limit(`agency:${a.id}`, 1500);
  return a;
}
export async function instanceId() {
  const row = (
    await query("SELECT instance_id FROM portal_settings WHERE id=1")
  ).rows[0];
  if (!row)
    throw new HttpError(503, "Instalación pendiente de inicialización.");
  return row.instance_id as string;
}
export function sameOrigin(request: Request) {
  if (
    !process.env.PORTAL_ORIGIN ||
    request.headers.get("origin") !== new URL(process.env.PORTAL_ORIGIN).origin
  )
    throw new HttpError(403, "Origen de solicitud no permitido.");
}
