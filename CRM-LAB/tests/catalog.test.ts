import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'test-only-secret-never-used-for-production-123456789';

const { catalogParams, likeTerm } = await import('../src/lib/catalog');

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
