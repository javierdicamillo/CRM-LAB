import { z } from 'zod';
import { pool } from './db';
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
  return schema.parse({
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
}

// Postgres ILIKE treats %, _ and \ as wildcards; user text must be literal.
export function likeTerm(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export async function searchCatalog(filters: CatalogFilters) {
  const rows = (
    await pool.query(
      `SELECT o.id,o.data AS offer,p.id AS property_id,p.data AS property,count(*) OVER() AS total
       FROM records o
       JOIN records p ON p.kind='property' AND p.id=NULLIF(o.data->>'propertyId','')::uuid
       WHERE o.kind='offer' AND o.data->>'publication'='published'
         AND p.data->>'status' IN ('available','reserved')
         AND EXISTS (SELECT 1 FROM photos ph WHERE ph.property_id=p.id AND ph.approved)
         AND ($1='%%' OR p.data->>'title' ILIKE $1 OR p.data->>'description' ILIKE $1
              OR p.data->>'city' ILIKE $1 OR p.data->>'neighborhood' ILIKE $1)
         AND ($2='%%' OR p.data->>'city' ILIKE $2)
         AND ($3='' OR o.data->>'operation'=$3)
         AND ($4='' OR p.data->>'type'=$4)
         AND (NULLIF($5,'')::numeric IS NULL OR (o.data->>'amount')::numeric>=NULLIF($5,'')::numeric)
         AND (NULLIF($6,'')::numeric IS NULL OR (o.data->>'amount')::numeric<=NULLIF($6,'')::numeric)
         AND ($7='' OR o.data->>'currency'=$7)
       ORDER BY o.updated_at DESC,o.id
       LIMIT $8 OFFSET $9`,
      [
        `%${likeTerm(filters.q)}%`,
        `%${likeTerm(filters.city)}%`,
        filters.operation,
        filters.type,
        filters.minPrice,
        filters.maxPrice,
        filters.currency,
        filters.limit,
        (filters.page - 1) * filters.limit,
      ],
    )
  ).rows;
  const total = rows.length ? Number(rows[0].total) : 0;
  return {
    total,
    page: filters.page,
    pages: Math.max(1, Math.ceil(total / filters.limit)),
    items: rows.map((row) => ({
      listing_id: row.id,
      ...publicListing({ id: row.property_id, data: row.property }, { data: row.offer }),
    })),
  };
}
