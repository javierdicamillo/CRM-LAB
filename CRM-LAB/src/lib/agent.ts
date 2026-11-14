import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { audit } from './db';
import { ApiError } from './errors';
import { publicListingById } from './catalog';
import { contactByPhone, createVisitActivity, isValidPhone, normalizePhone, phoneDigits } from './whatsapp';

type Queryable = Pick<PoolClient, 'query'>;

// Entrada del agente de WhatsApp para registrar una conversación. Nunca crea
// propiedades ni publicaciones: solo contacto, resumen y solicitud de visita.
// El Function Tool de Kapso puede mandar "" o claves extra: se normalizan sin
// relajar la validación de lo que sí se usa.
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const booleanFlag = (value: unknown) => (value === 'true' ? true : value === 'false' ? false : value);

export const agentLeadSchema = z.object({
  phone: z.preprocess(
    (value) => (typeof value === 'number' ? String(value) : value),
    z.string().trim().min(6).max(40),
  ),
  name: z.preprocess(blankToUndefined, z.string().trim().min(1).max(180).optional()),
  listing_id: z.preprocess(blankToUndefined, z.uuid().optional()),
  summary: z.preprocess(blankToUndefined, z.string().trim().max(2000).optional()),
  visit_requested: z.preprocess(booleanFlag, z.boolean().default(false)),
});

export type AgentLeadInput = z.infer<typeof agentLeadSchema>;

export type AgentLeadResult = {
  contact_id: string;
  created: boolean;
  property_id: string | null;
  visit_activity_id: string | null;
  summary_saved: boolean;
};

export async function saveAgentLead(client: Queryable, input: AgentLeadInput): Promise<AgentLeadResult> {
  if (!isValidPhone(input.phone)) throw new ApiError(400, 'El teléfono del contacto no es válido.');
  const phone = normalizePhone(input.phone);
  const summary = input.summary?.trim() ?? '';
  if (!input.name && !input.listing_id && !summary && !input.visit_requested) {
    throw new ApiError(400, 'La solicitud no trae datos para guardar.');
  }

  // Serializa por teléfono: dos mensajes simultáneos no duplican el contacto.
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [phoneDigits(input.phone)]);
  let contact = await contactByPhone(client, phone);
  const created = !contact;

  const listing = input.listing_id ? await publicListingById(client, input.listing_id) : null;
  if (input.listing_id && !listing) throw new ApiError(409, 'La oferta no está publicada en el catálogo.');

  const propertyId: string = listing?.property_id ?? contact?.data?.whatsappPropertyId ?? '';
  const assigneeId: string = listing?.property?.assigneeId || contact?.data?.assigneeId || '';

  if (!contact) {
    const inserted = await client.query("INSERT INTO records(id,kind,data) VALUES($1,'contact',$2) RETURNING *", [
      randomUUID(),
      JSON.stringify({
        name: input.name ?? `WhatsApp ${phoneDigits(input.phone)}`,
        email: '',
        phone,
        type: 'buyer',
        notes: 'Contacto creado por el agente de WhatsApp.',
        assigneeId,
        ...(propertyId ? { whatsappPropertyId: propertyId } : {}),
      }),
    ]);
    contact = inserted.rows[0];
    await audit(client, null, 'agent.contact_created', contact.id);
  }

  const changes: Record<string, unknown> = {};
  if (input.name && input.name !== contact.data?.name) changes.name = input.name;
  if (propertyId && propertyId !== contact.data?.whatsappPropertyId) changes.whatsappPropertyId = propertyId;

  let summarySaved = false;
  if (summary) {
    const notes = typeof contact.data?.notes === 'string' ? contact.data.notes : '';
    // Un reintento del agente no duplica el mismo resumen.
    if (!notes.includes(summary)) {
      const line = `Resumen del agente (${new Date().toISOString()}): ${summary}`;
      changes.notes = notes.trim() ? `${notes}\n${line}` : line;
      summarySaved = true;
    }
  }

  if (Object.keys(changes).length) {
    await client.query("UPDATE records SET data=data||$2::jsonb,version=version+1,updated_at=now() WHERE id=$1 AND kind='contact'", [
      contact.id,
      JSON.stringify(changes),
    ]);
  }

  let visitActivityId: string | null = null;
  if (input.visit_requested) {
    visitActivityId = await createVisitActivity(client, {
      contactId: contact.id,
      propertyId,
      assigneeId,
      title: listing?.property?.title
        ? `Visita solicitada · ${listing.property.title}`
        : `Visita solicitada · ${contact.data?.name ?? phone}`,
      notes: summary
        ? `Solicitud recibida por el agente de WhatsApp. Resumen: "${summary}"`
        : 'Solicitud recibida por el agente de WhatsApp.',
    });
    await audit(client, null, 'agent.visit_requested', contact.id);
  }

  return {
    contact_id: contact.id,
    created,
    property_id: propertyId || null,
    visit_activity_id: visitActivityId,
    summary_saved: summarySaved,
  };
}
