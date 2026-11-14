import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { ApiError } from './errors';
import { publicListing } from './business';

const propertyTypes = ['apartment', 'house', 'land', 'office', 'store', 'warehouse', 'other'] as const;
const amount = z.union([
  z.literal(''),
  z.string().trim().regex(/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$/),
]);

const schema = z.object({
  q: z.string().trim().max(100).default(''),
  city: z.string().trim().max(180).default(''),
  operation: z.union([z.literal(''), z.enum(['sale', 'rent'])]).default(''),
  type: z.union([z.literal(''), z.enum(propertyTypes)]).default(''),
  minPrice: amount.default(''),
  maxPrice: amount.default(''),
  currency: z.union([z.literal(''), z.enum(['USD', 'ARS', 'EUR'])]).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type CatalogFilters = z.infer<typeof schema>;

export function catalogParams(search: URLSearchParams): CatalogFilters {
  const filters = schema.parse({
    q: search.get('q') ?? '',
    city: search.get('city') ?? '',
    operation: search.get('operation') ?? '',
    type: search.get('type') ?? '',
    minPrice: search.get('min_price') ?? '',
    maxPrice: search.get('max_price') ?? '',
    currency: search.get('currency') ?? '',
    page: search.get('page') ?? 1,
    limit: search.get('limit') ?? 12,
  });
  if (filters.minPrice && filters.maxPrice && Number(filters.minPrice) > Number(filters.maxPrice)) {
    throw new ApiError(400, 'El precio mínimo no puede superar el precio máximo.');
  }
  return filters;
}

// Postgres ILIKE treats %, _ and \ as wildcards; user text must be literal.
export function likeTerm(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

const catalogSource = `FROM records o
  JOIN records p ON p.kind='property' AND p.id=NULLIF(o.data->>'propertyId','')::uuid
  WHERE o.kind='offer' AND o.data->>'publication'='published'
    AND p.data->>'status' IN ('available','reserved')
    AND EXISTS (SELECT 1 FROM photos ph WHERE ph.property_id=p.id AND ph.approved)`;

const filtersSql = `
    AND ($1='%%' OR p.data->>'title' ILIKE $1 OR p.data->>'description' ILIKE $1
         OR p.data->>'city' ILIKE $1 OR p.data->>'neighborhood' ILIKE $1)
    AND ($2='%%' OR p.data->>'city' ILIKE $2)
    AND ($3='' OR o.data->>'operation'=$3)
    AND ($4='' OR p.data->>'type'=$4)
    AND (NULLIF($5,'')::numeric IS NULL OR (o.data->>'amount')::numeric>=NULLIF($5,'')::numeric)
    AND (NULLIF($6,'')::numeric IS NULL OR (o.data->>'amount')::numeric<=NULLIF($6,'')::numeric)
    AND ($7='' OR o.data->>'currency'=$7)`;

export async function searchCatalog(filters: CatalogFilters) {
  const params = [
    `%${likeTerm(filters.q)}%`,
    `%${likeTerm(filters.city)}%`,
    filters.operation,
    filters.type,
    filters.minPrice,
    filters.maxPrice,
    filters.currency,
  ];
  const where = `${catalogSource}${filtersSql}`;
  // Separate count: count(*) OVER() loses the total when OFFSET skips every row.
  const count = await pool.query(`SELECT count(*) AS total ${where}`, params);
  const rows = (
    await pool.query(
      `SELECT o.id,o.data AS offer,p.id AS property_id,p.data AS property ${where}
       ORDER BY o.updated_at DESC,o.id
       LIMIT $8 OFFSET $9`,
      [...params, filters.limit, (filters.page - 1) * filters.limit],
    )
  ).rows;
  const total = Number(count.rows[0]?.total ?? 0);
  return {
    total,
    page: filters.page,
    pages: Math.max(1, Math.ceil(total / filters.limit)),
    items: rows.map((row) => ({
      listing_id: row.id,
      ...publicListing({ id: row.property_id, data: row.property }, { data: row.offer }),
      property_status: row.property.status,
    })),
  };
}

// Mismas condiciones de visibilidad que el listado: la escritura del agente no
// puede referenciar una oferta que ya no está publicada.
export async function publicListingById(client: Pick<PoolClient, 'query'>, listingId: string) {
  const row = (
    await client.query(
      `SELECT o.id,o.data AS offer,p.id AS property_id,p.data AS property ${catalogSource} AND o.id=$1`,
      [listingId],
    )
  ).rows[0];
  return row ?? null;
}
