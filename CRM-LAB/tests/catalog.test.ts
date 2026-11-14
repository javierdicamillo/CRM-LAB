import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'test-only-secret-never-used-for-production-123456789';

const { catalogParams, likeTerm, searchCatalog } = await import('../src/lib/catalog');
const { pool } = await import('../src/lib/db');

type QueryResult = { rows: any[] };
type Call = { sql: string; params: any[] };

async function stubQueries(responses: QueryResult[], run: () => Promise<unknown>) {
  const calls: Call[] = [];
  const original = pool.query;
  let index = 0;
  (pool as any).query = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    return responses[index++] ?? { rows: [] };
  };
  try {
    const value = await run();
    return { value, calls };
  } finally {
    (pool as any).query = original;
  }
}

const property = {
  id: '11111111-1111-4111-8111-111111111111',
  data: {
    title: 'Casa Centro',
    description: 'Texto público',
    type: 'house',
    status: 'available',
    country: 'AR',
    region: 'Neuquén',
    city: 'Neuquén',
    neighborhood: 'Centro',
    publicAddress: 'Rivadavia 100',
    privateAddress: 'NO PUBLICAR',
    privateNotes: 'SECRETO',
    ownerId: 'privado',
    area: 120,
    bedrooms: 3,
    bathrooms: 2,
  },
};
const offer = {
  operation: 'sale',
  amount: '120000.00',
  currency: 'USD',
  period: 'total',
  notes: 'COMISION PRIVADA',
};

test('el catálogo solo publica ofertas publicadas de inmuebles disponibles o reservados con foto aprobada', async () => {
  const { value, calls } = await stubQueries(
    [
      { rows: [{ total: '1' }] },
      { rows: [{ id: 'offer-1', property_id: property.id, property: property.data, offer }] },
    ],
    () => searchCatalog(catalogParams(new URLSearchParams('limit=5&page=3'))),
  );

  const sql = calls.map((call) => call.sql).join('\n');
  assert.match(sql, /o\.data->>'publication'='published'/);
  assert.match(sql, /p\.data->>'status' IN \('available','reserved'\)/);
  assert.match(sql, /EXISTS \(SELECT 1 FROM photos ph WHERE ph\.property_id=p\.id AND ph\.approved\)/);
  assert.deepEqual(calls[1].params.slice(7), [5, 10]);

  const body = JSON.stringify(value);
  assert.ok(!body.includes('NO PUBLICAR'), body);
  assert.ok(!body.includes('SECRETO'), body);
  assert.ok(!body.includes('privado'), body);
  assert.ok(!body.includes('COMISION'), body);

  const catalog = value as { total: number; items: any[] };
  assert.equal(catalog.total, 1);
  assert.equal(catalog.items[0].listing_id, 'offer-1');
  assert.equal(catalog.items[0].title, 'Casa Centro');
  assert.equal(catalog.items[0].property_status, 'available');
});

test('una página fuera de rango conserva el total real de coincidencias', async () => {
  const { value } = await stubQueries(
    [{ rows: [{ total: '7' }] }, { rows: [] }],
    () => searchCatalog(catalogParams(new URLSearchParams('limit=3&page=9'))),
  );

  const catalog = value as { total: number; pages: number; items: any[] };
  assert.equal(catalog.total, 7);
  assert.equal(catalog.pages, 3);
  assert.deepEqual(catalog.items, []);
});

test('rechaza un rango de precios invertido', () => {
  assert.throws(
    () => catalogParams(new URLSearchParams('min_price=100&max_price=50')),
    (error: any) => error.status === 400,
  );
});

test('normaliza filtros del catálogo y aplica valores por defecto', () => {
  assert.deepEqual(catalogParams(new URLSearchParams()), {
    q: '',
    city: '',
    operation: '',
    type: '',
    minPrice: '',
    maxPrice: '',
    currency: '',
    page: 1,
    limit: 12,
  });
  assert.deepEqual(
    catalogParams(
      new URLSearchParams(
        'q=Casa&city=Neuqu%C3%A9n&operation=sale&type=house&min_price=100000&max_price=250000.50&currency=USD&page=2&limit=5',
      ),
    ),
    {
      q: 'Casa',
      city: 'Neuquén',
      operation: 'sale',
      type: 'house',
      minPrice: '100000',
      maxPrice: '250000.50',
      currency: 'USD',
      page: 2,
      limit: 5,
    },
  );
});

test('rechaza filtros inválidos del catálogo', () => {
  const invalid = [
    'operation=swap',
    'type=castle',
    'currency=BRL',
    'min_price=-1',
    'min_price=abc',
    'min_price=1.234',
    'max_price=0100',
    `q=${'a'.repeat(101)}`,
    'limit=0',
    'limit=51',
    'page=0',
    'page=1.5',
  ];
  for (const query of invalid) {
    assert.throws(() => catalogParams(new URLSearchParams(query)), query);
  }
});

test('escapa comodines de ILIKE en el texto libre', () => {
  assert.equal(likeTerm('50%_off\\'), '50\\%\\_off\\\\');
  assert.equal(likeTerm('Casa'), 'Casa');
});
