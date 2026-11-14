import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/test';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'test-only-secret-never-used-for-production-123456789';

const { agentLeadSchema, saveAgentLead } = await import('../src/lib/agent');

type Responder = { match: RegExp; rows: any[] };
type Call = { sql: string; params: any[] };

function fakeClient(responders: Responder[]) {
  const calls: Call[] = [];
  return {
    calls,
    query: async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      const found = responders.find((responder) => responder.match.test(sql));
      if (!found) throw new Error(`consulta inesperada: ${sql}`);
      return { rows: found.rows };
    },
  };
}

const contact = {
  id: 'contact-1',
  data: { name: 'Juan', phone: '5491123456789', type: 'buyer', notes: '', assigneeId: '', whatsappPropertyId: '' },
};

const listing = {
  id: 'offer-1',
  property_id: 'property-1',
  property: { title: 'Casa Centro', type: 'house', status: 'available', assigneeId: 'agent-1' },
  offer: { operation: 'sale', amount: '120000.00', currency: 'USD', period: 'total' },
};

const always = (rows: any[]): Responder => ({ match: /.*/, rows });

test('crea el contacto y guarda resumen y solicitud de visita', async () => {
  const client = fakeClient([
    { match: /pg_advisory_xact_lock/, rows: [] },
    { match: /FROM records\s+WHERE kind='contact'/, rows: [] },
    { match: /right\(regexp_replace/, rows: [] },
    { match: /SELECT o\.id,o\.data AS offer/, rows: [listing] },
    { match: /INSERT INTO records\(id,kind,data\) VALUES\(\$1,'contact'/, rows: [{ id: 'contact-1', data: {} }] },
    { match: /UPDATE records SET data=data\|\|/, rows: [] },
    { match: /INSERT INTO records\(id,kind,data\) VALUES\(\$1,'activity'/, rows: [] },
    { match: /INSERT INTO audit/, rows: [] },
  ]);

  const result = await saveAgentLead(client as any, agentLeadSchema.parse({
    phone: '+54 9 11 2345-6789',
    name: 'Juan',
    listing_id: '8f1c2b7e-5a4d-4c9e-9b21-7d3f0a6c1e44',
    summary: 'Busca casa de 3 dormitorios en el centro.',
    visit_requested: true,
  }));

  assert.equal(result.created, true);
  assert.equal(result.contact_id, 'contact-1');
  assert.equal(result.property_id, 'property-1');
  assert.equal(result.summary_saved, true);
  assert.ok(result.visit_activity_id);

  const activity = client.calls.find((call) => /'activity'/.test(call.sql));
  const data = JSON.parse(activity!.params[1]);
  assert.equal(data.type, 'visit');
  assert.equal(data.contactId, 'contact-1');
  assert.equal(data.propertyId, 'property-1');
  assert.match(data.notes, /3 dormitorios/);
});

test('actualiza un contacto existente sin duplicarlo', async () => {
  const client = fakeClient([
    { match: /pg_advisory_xact_lock/, rows: [] },
    { match: /FROM records\s+WHERE kind='contact'/, rows: [contact] },
    { match: /UPDATE records SET data=data\|\|/, rows: [] },
    always([]),
  ]);

  const result = await saveAgentLead(client as any, agentLeadSchema.parse({
    phone: '5491123456789',
    summary: 'Prefiere contacto por la tarde.',
  }));

  assert.equal(result.created, false);
  assert.equal(client.calls.some((call) => /'contact'/.test(call.sql) && /INSERT/.test(call.sql)), false);
  const update = client.calls.find((call) => /UPDATE records SET data=data\|\|/.test(call.sql));
  const changes = JSON.parse(update!.params[1]);
  assert.match(changes.notes, /por la tarde/);
});

test('rechaza una oferta que ya no está publicada', async () => {
  const client = fakeClient([
    { match: /pg_advisory_xact_lock/, rows: [] },
    { match: /FROM records\s+WHERE kind='contact'/, rows: [contact] },
    { match: /SELECT o\.id,o\.data AS offer/, rows: [] },
    always([]),
  ]);

  await assert.rejects(
    () => saveAgentLead(client as any, agentLeadSchema.parse({ phone: '5491123456789', listing_id: '8f1c2b7e-5a4d-4c9e-9b21-7d3f0a6c1e44' })),
    (error: any) => error.status === 409,
  );
});

test('acepta el payload del Function Tool con campos vacíos o extra', () => {
  const parsed = agentLeadSchema.parse({
    phone: 5491123456789,
    name: '',
    listing_id: '',
    summary: '  ',
    visit_requested: 'true',
    conversation_id: 'no-se-usa',
  });
  assert.equal(parsed.phone, '5491123456789');
  assert.equal(parsed.name, undefined);
  assert.equal(parsed.listing_id, undefined);
  assert.equal(parsed.summary, undefined);
  assert.equal(parsed.visit_requested, true);
  assert.equal('conversation_id' in parsed, false);
  assert.equal(agentLeadSchema.parse({ phone: '5491123456789', visit_requested: 'false' }).visit_requested, false);
});

test('exige teléfono válido y al menos un dato para guardar', async () => {
  const client = fakeClient([always([])]);
  await assert.rejects(
    () => saveAgentLead(client as any, agentLeadSchema.parse({ phone: '1234567' })),
    (error: any) => error.status === 400,
  );
  await assert.rejects(
    () => saveAgentLead(client as any, agentLeadSchema.parse({ phone: '5491123456789' })),
    (error: any) => error.status === 400,
  );
  const withRole = agentLeadSchema.parse({ phone: '5491123456789', role: 'admin' });
  assert.equal('role' in withRole, false);
});
