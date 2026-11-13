import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction, audit } from './db';
import { KapsoError, sendWhatsAppText } from './kapso';
import type { Lead } from './katy';

type Queryable = Pick<PoolClient, 'query'>;

// Si responde un agente de Kapso (workflow), el CRM solo registra: WHATSAPP_AUTOREPLY=off.
export function whatsappAutoreplyEnabled(): boolean {
  return (process.env.WHATSAPP_AUTOREPLY ?? 'on').trim().toLowerCase() !== 'off';
}

// Kapso firma el body crudo: X-Webhook-Signature = HMAC-SHA256(secreto, body) en hex.
export function verifyWebhookSignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// Normalización mínima del piloto argentino: sin selector de país.
export function normalizePhone(value: string): string {
  let digits = phoneDigits(value ?? '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) return '';
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) return `549${digits}`;
  if (digits.length === 12 && digits.startsWith('54')) return `549${digits.slice(2)}`;
  return digits;
}

export function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value);
  return digits.length >= 8 && digits.length <= 15;
}

export function greetingText(name: string, propertyTitle: string): string {
  const title = propertyTitle.trim() || 'la propiedad';
  return `¡Hola ${name}! 👋 Gracias por escribirnos y por tu interés en ${title}. Soy Cerreme, tu asistente personal. Preguntame lo que quieras sobre la propiedad: precio, ubicación, requisitos o descripción. Y si querés, coordinamos una visita.`;
}

export async function enqueueGreeting(
  client: Queryable,
  input: { leadId: string; propertyId: string | null; name: string; propertyTitle: string; inboxId: string },
): Promise<void> {
  await client.query(
    `INSERT INTO whatsapp_messages(id,lead_id,property_id,direction,body,state,dedupe_key)
     VALUES($1,$2,$3,'outbound',$4,'pending',$5)
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [randomUUID(), input.leadId, input.propertyId, greetingText(input.name, input.propertyTitle), `greeting:${input.inboxId}`],
  );
}

export async function saveInbound(
  client: Queryable,
  input: { leadId: string | null; propertyId: string | null; body: string; dedupeKey: string | null },
): Promise<{ inserted: boolean; id: string | null }> {
  const result = await client.query(
    `INSERT INTO whatsapp_messages(id,lead_id,property_id,direction,body,state,dedupe_key,sent_at)
     VALUES($1,$2,$3,'inbound',$4,'received',$5,now())
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [randomUUID(), input.leadId, input.propertyId, input.body, input.dedupeKey],
  );
  return { inserted: result.rowCount === 1, id: result.rows[0]?.id ?? null };
}

export async function enqueueReply(
  client: Queryable,
  input: { leadId: string; propertyId: string | null; body: string; dedupeKey: string },
): Promise<void> {
  await client.query(
    `INSERT INTO whatsapp_messages(id,lead_id,property_id,direction,body,state,dedupe_key)
     VALUES($1,$2,$3,'outbound',$4,'pending',$5)
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [randomUUID(), input.leadId, input.propertyId, input.body, input.dedupeKey],
  );
}

function priceLabel(offer: any): string {
  if (!offer || offer.amount === undefined || offer.amount === null || offer.amount === '') return '';
  const amount = Number(offer.amount);
  if (!Number.isFinite(amount)) return '';
  const currency = ['ARS', 'USD', 'EUR'].includes(offer.currency) ? offer.currency : 'ARS';
  const formatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
  const period = offer.period === 'month' ? ' por mes' : offer.period === 'day' ? ' por día' : '';
  return `${formatted}${period}`;
}

function locationLabel(property: any): string {
  return [property?.publicAddress, property?.neighborhood, property?.city, property?.region]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(', ');
}

async function contactByPhone(client: Queryable, phone: string): Promise<any | null> {
  const digits = phoneDigits(phone);
  if (digits.length < 8) return null;
  const exact = await client.query(
    `SELECT * FROM records
     WHERE kind='contact' AND regexp_replace(coalesce(data->>'phone',''),'[^0-9]','','g')=$1
     ORDER BY updated_at DESC LIMIT 1`,
    [digits],
  );
  if (exact.rows[0]) return exact.rows[0];
  if (digits.length < 10) return null;
  const suffix = await client.query(
    `SELECT * FROM records
     WHERE kind='contact' AND right(regexp_replace(coalesce(data->>'phone',''),'[^0-9]','','g'),10)=$1
     ORDER BY updated_at DESC LIMIT 1`,
    [digits.slice(-10)],
  );
  return suffix.rows[0] ?? null;
}

export async function findContactByPhone(phone: string): Promise<any | null> {
  return contactByPhone(pool, phone);
}

// Un número desconocido que escribe por WhatsApp se da de alta como contacto.
// El advisory lock evita duplicados si llegan dos mensajes a la vez.
export async function findOrCreateContact(input: { phone: string; name?: string }): Promise<any> {
  const digits = phoneDigits(input.phone);
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [digits]);
    const existing = await contactByPhone(client, input.phone);
    if (existing) return existing;
    const name = (input.name ?? '').trim().slice(0, 180) || `WhatsApp ${digits}`;
    const data = {
      name,
      email: '',
      phone: normalizePhone(input.phone),
      type: 'buyer',
      notes: 'Contacto creado automáticamente desde WhatsApp.',
      assigneeId: '',
    };
    const inserted = await client.query("INSERT INTO records(id,kind,data) VALUES($1,'contact',$2) RETURNING *", [
      randomUUID(),
      JSON.stringify(data),
    ]);
    await audit(client, null, 'whatsapp.contact_created', inserted.rows[0].id);
    return inserted.rows[0];
  });
}

export async function loadLead(contact: any): Promise<{
  lead: Lead;
  opportunityId: string | null;
  propertyId: string | null;
}> {
  // La consulta del portal guarda la propiedad consultada: se prioriza sobre
  // la oportunidad más reciente para no responder con otra propiedad.
  const preferred =
    typeof contact.data?.whatsappPropertyId === 'string' ? contact.data.whatsappPropertyId : '';
  const related = await pool.query(
    `SELECT o.id AS opportunity_id, o.data AS opportunity, off.id AS offer_id, off.data AS offer,
            p.id AS property_id, p.data AS property
     FROM records o
     LEFT JOIN records off ON off.kind='offer' AND off.id = NULLIF(o.data->>'offerId','')::uuid
     LEFT JOIN records p ON p.kind='property' AND p.id = NULLIF(off.data->>'propertyId','')::uuid
     WHERE o.kind='opportunity' AND o.data->>'contactId'=$1
     ORDER BY CASE WHEN $2 <> '' AND off.data->>'propertyId'=$2 THEN 0 ELSE 1 END, o.created_at DESC
     LIMIT 1`,
    [contact.id, preferred],
  );
  const row = related.rows[0] ?? null;
  const property = row?.property ?? null;
  const offer = row?.offer ?? null;

  return {
    lead: {
      id: contact.id,
      name: typeof contact.data?.name === 'string' ? contact.data.name : '',
      phone: typeof contact.data?.phone === 'string' ? contact.data.phone : '',
      property: property
        ? {
            id: row.property_id,
            title: typeof property.title === 'string' ? property.title : '',
            description: typeof property.description === 'string' ? property.description : '',
            location: locationLabel(property),
            // Requisitos/condiciones: se reutiliza offer.notes (aprobado para la demo).
            requirements: typeof offer?.notes === 'string' ? offer.notes.trim() : '',
            price: priceLabel(offer),
          }
        : null,
      pendingIntent: typeof contact.data?.whatsappPending === 'string' ? contact.data.whatsappPending : '',
      nextPendingIntent: '',
      actions: [],
    },
    opportunityId: row?.opportunity_id ?? null,
    propertyId: row?.property_id ?? null,
  };
}

async function updateContact(
  client: Queryable,
  leadId: string,
  update: (data: Record<string, any>) => Record<string, any>,
) {
  const row = (await client.query("SELECT data FROM records WHERE id=$1 AND kind='contact' FOR UPDATE", [leadId])).rows[0];
  if (!row) return;
  await client.query('UPDATE records SET data=$2, version=version+1, updated_at=now() WHERE id=$1', [
    leadId,
    JSON.stringify(update(row.data ?? {})),
  ]);
}

export async function applyLeadActions(
  client: Queryable,
  lead: Lead,
  context: { opportunityId: string | null; propertyId: string | null },
): Promise<void> {
  for (const action of lead.actions) {
    if (action.type === 'agent') {
      await updateContact(client, lead.id, (data) => {
        const note = `Pidió agente por WhatsApp (${new Date().toISOString()}).`;
        const notes = typeof data.notes === 'string' && data.notes.trim() ? `${data.notes}\n${note}` : note;
        return { ...data, notes, whatsappPending: '' };
      });
      await audit(client, null, 'whatsapp.agent_requested', lead.id);
    }

    if (action.type === 'visit_request') {
      const contact = (
        await client.query("SELECT data FROM records WHERE id=$1 AND kind='contact' FOR UPDATE", [lead.id])
      ).rows[0];
      if (!contact) continue;
      const property = context.propertyId
        ? (await client.query("SELECT data FROM records WHERE id=$1 AND kind='property'", [context.propertyId])).rows[0]
        : null;
      // La fecha pedida queda en las notas; la actividad vence ahora para que el agente la vea.
      const dueAt = new Date().toISOString();
      const title = property?.data?.title
        ? `Visita solicitada · ${property.data.title}`
        : `Visita solicitada · ${lead.name}`;
      await client.query("INSERT INTO records(id,kind,data) VALUES($1,'activity',$2)", [
        randomUUID(),
        JSON.stringify({
          title,
          type: 'visit',
          dueAt,
          done: false,
          contactId: lead.id,
          propertyId: context.propertyId ?? '',
          opportunityId: context.opportunityId ?? '',
          assigneeId: property?.data?.assigneeId ?? contact.data?.assigneeId ?? '',
          notes: `Solicitud recibida por WhatsApp. El cliente escribió: "${action.text}"`,
        }),
      ]);
      await client.query('UPDATE records SET data=$2, version=version+1, updated_at=now() WHERE id=$1', [
        lead.id,
        JSON.stringify({ ...contact.data, whatsappPending: '' }),
      ]);
      await audit(client, null, 'whatsapp.visit_requested', lead.id);
    }
  }

  if (lead.nextPendingIntent !== lead.pendingIntent) {
    await updateContact(client, lead.id, (data) => ({ ...data, whatsappPending: lead.nextPendingIntent }));
  }
}

export async function processWhatsAppQueue(limit = 20): Promise<{ sent: number; failed: number }> {
  // Reclamo atómico: evita que el webhook y el worker envíen el mismo mensaje a la vez.
  const rows = (
    await pool.query(
      `UPDATE whatsapp_messages SET next_at=now()+interval '2 minutes'
       WHERE id IN (
         SELECT id FROM whatsapp_messages
         WHERE direction='outbound' AND state='pending' AND next_at<=now()
         ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit],
    )
  ).rows;
  let sent = 0;
  let failed = 0;

  for (const message of rows) {
    try {
      if (!message.lead_id) throw new KapsoError(400, 'El mensaje no tiene un lead asociado.');
      const contact = (await pool.query("SELECT data FROM records WHERE id=$1 AND kind='contact'", [message.lead_id])).rows[0];
      if (!contact) throw new KapsoError(400, 'El lead ya no existe.');
      if (!contact.data?.phone) throw new KapsoError(400, 'El lead no tiene teléfono.');

      const result = await sendWhatsAppText(contact.data.phone, message.body);
      await pool.query(
        "UPDATE whatsapp_messages SET state='sent', attempts=attempts+1, sent_at=now(), external_id=$2, error=null WHERE id=$1",
        [message.id, result.messageId],
      );
      sent += 1;
    } catch (error) {
      const kapso = error instanceof KapsoError ? error : null;
      const detail = error instanceof Error ? error.message : 'Error de envío desconocido.';
      const attempts = Number(message.attempts) || 0;
      // 403 por sesión de sandbox y 422 por ventana de 24 h se reintentan, pero
      // con tope: un saludo fuera de ventana no debe reintentar para siempre.
      const permanent =
        kapso !== null &&
        ([400, 401, 404, 413].includes(kapso.status) ||
          (kapso.status === 403 && !/sandbox session/i.test(kapso.detail)) ||
          attempts >= 7);
      const delay = Math.min(3600, 15 * 2 ** Math.min(attempts, 7));
      console.error('No se pudo enviar WhatsApp', message.id, detail);
      await pool.query(
        `UPDATE whatsapp_messages
         SET state=$2, attempts=attempts+1, next_at=now()+($3*interval '1 second'), error=$4
         WHERE id=$1`,
        [message.id, permanent ? 'failed' : 'pending', delay, detail.slice(0, 250)],
      );
      failed += 1;
    }
  }

  return { sent, failed };
}
