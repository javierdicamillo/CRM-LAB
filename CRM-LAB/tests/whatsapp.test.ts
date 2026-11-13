import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { Lead } from '../src/lib/katy';

process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'test-only-secret-never-used-for-production-123456789';

const { normalizePhone, isValidPhone, verifyWebhookSignature } = await import('../src/lib/whatsapp');
const { KatyResponder } = await import('../src/lib/katy');

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ana',
    phone: '+54 9 299 603 5274',
    property: {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Casa en General Roca',
      description: 'Casa luminosa de 3 ambientes.',
      location: 'Centro, General Roca, Río Negro',
      requirements: 'Recibo de sueldo y garantía.',
      price: 'USD 100.000',
    },
    pendingIntent: '',
    nextPendingIntent: '',
    actions: [],
    ...overrides,
  };
}

test('normaliza teléfonos argentinos del portal y de WhatsApp', () => {
  assert.equal(normalizePhone('299 603-5274'), '5492996035274');
  assert.equal(normalizePhone('011 6706-2068'), '5491167062068');
  assert.equal(normalizePhone('+54 9 299 603 5274'), '5492996035274');
  assert.equal(normalizePhone('54 299 603 5274'), '5492996035274');
  assert.equal(normalizePhone(''), '');
  assert.equal(isValidPhone('299 603-5274'), true);
  assert.equal(isValidPhone('123'), false);
});

test('responde precio, ubicación, requisitos y descripción', () => {
  const katy = new KatyResponder();
  assert.match(katy.responder('¿Cuánto sale?', lead()), /USD 100\.000/);
  assert.match(katy.responder('¿Dónde queda?', lead()), /Centro, General Roca/);
  assert.match(katy.responder('¿Qué requisitos piden?', lead()), /Recibo de sueldo/);
  assert.match(katy.responder('Contame los metros y ambientes', lead()), /Casa luminosa de 3 ambientes/);
});

test('registra una visita en dos pasos', () => {
  const katy = new KatyResponder();
  const current = lead();
  assert.match(katy.responder('Quiero visitar la casa', current), /qué día y horario/);
  assert.equal(current.nextPendingIntent, 'visit_date');
  current.pendingIntent = current.nextPendingIntent;
  current.nextPendingIntent = '';
  assert.match(katy.responder('El sábado a las 10', current), /un agente te confirma/);
  assert.deepEqual(current.actions, [{ type: 'visit_request', text: 'El sábado a las 10' }]);
});

test('deriva a un agente y acepta la confirmación pendiente', () => {
  const katy = new KatyResponder();
  const direct = lead();
  assert.match(katy.responder('Quiero hablar con una persona', direct), /un agente/);
  assert.deepEqual(direct.actions, [{ type: 'agent' }]);

  const pending = lead({ pendingIntent: 'offer_agent' });
  katy.responder('sí, dale', pending);
  assert.deepEqual(pending.actions, [{ type: 'agent' }]);
});

test('pide datos cuando no entiende y no inventa sin propiedad', () => {
  const katy = new KatyResponder();
  const unknown = lead();
  assert.match(katy.responder('asdf qwer', unknown), /No tengo ese dato/);
  assert.equal(unknown.nextPendingIntent, 'offer_agent');

  const withoutProperty = lead({ property: null });
  assert.match(katy.responder('¿Cuánto sale?', withoutProperty), /No tengo ese dato/);
  assert.equal(withoutProperty.actions.length, 0);
});

test('verifica la firma HMAC-SHA256 del webhook de Kapso', () => {
  const secret = 'secreto-de-prueba';
  const body = JSON.stringify({ hello: 'mundo' });
  const good = createHmac('sha256', secret).update(body).digest('hex');

  assert.equal(verifyWebhookSignature(body, good, secret), true);
  assert.equal(verifyWebhookSignature(body, good.toUpperCase(), secret), true);
  assert.equal(verifyWebhookSignature(`${body} `, good, secret), false);
  assert.equal(verifyWebhookSignature(body, 'x'.repeat(64), secret), false);
  assert.equal(verifyWebhookSignature(body, good.slice(2), secret), false);
  assert.equal(verifyWebhookSignature(body, null, secret), false);
});
