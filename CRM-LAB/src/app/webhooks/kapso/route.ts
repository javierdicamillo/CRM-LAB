import { KatyResponder } from '@/lib/katy';
import {
  applyLeadActions,
  enqueueReply,
  findOrCreateContact,
  loadLead,
  phoneDigits,
  processWhatsAppQueue,
  saveInbound,
  verifyWebhookSignature,
} from '@/lib/whatsapp';
import { transaction } from '@/lib/db';

export const dynamic = 'force-dynamic';

const responder = new KatyResponder();

function senderPhone(event: any): string {
  return phoneDigits(String(event?.conversation?.phone_number ?? event?.message?.from ?? ''));
}

function eventText(message: any): string {
  const body = message?.text?.body;
  if (typeof body === 'string' && body.trim()) return body.trim();
  const content = message?.kapso?.content;
  if (typeof content === 'string' && content.trim()) return content.trim();
  return '';
}

async function handleEvent(event: any): Promise<'processed' | 'ignored' | 'duplicate'> {
  const message = event?.message;
  if (!message || message?.kapso?.direction !== 'inbound') return 'ignored';

  const phone = senderPhone(event);
  if (phone.length < 8) return 'ignored';

  const dedupeBase =
    String(message.id ?? '').trim() ||
    (message.timestamp ? `${phone}:${String(message.timestamp)}` : '');
  const dedupeKey = dedupeBase ? `inbound:${dedupeBase}` : null;
  const text = eventText(message);
  const body = text || `[${message.type ?? 'mensaje'}]`;
  const contactName =
    typeof event?.conversation?.kapso?.contact_name === 'string'
      ? event.conversation.kapso.contact_name
      : undefined;

  // Un número desconocido se da de alta como contacto en lugar de descartarse.
  const contact = await findOrCreateContact({ phone, name: contactName });
  const { lead, opportunityId, propertyId } = await loadLead(contact);
  const reply = text ? responder.responder(text, lead) : '';

  // Inbound, respuesta y acciones se confirman juntos: si algo falla, Kapso
  // reintenta y no se pierde la respuesta por el dedupe del mensaje entrante.
  return transaction(async (client) => {
    const saved = await saveInbound(client, {
      leadId: lead.id,
      propertyId,
      body,
      dedupeKey,
    });
    if (!saved.inserted) return 'duplicate';
    if (!text) return 'ignored';
    if (dedupeBase) {
      await enqueueReply(client, {
        leadId: lead.id,
        propertyId,
        body: reply,
        dedupeKey: `reply:${dedupeBase}`,
      });
    }
    await applyLeadActions(client, lead, { opportunityId, propertyId });
    return 'processed';
  });
}

export async function POST(request: Request) {
  const secret = process.env.KAPSO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error('Webhook de Kapso rechazado: falta KAPSO_WEBHOOK_SECRET.');
    return Response.json({ error: 'Webhook no configurado.' }, { status: 503 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw) > 1_000_000) {
    return Response.json({ error: 'Contenido demasiado grande.' }, { status: 413 });
  }
  if (!verifyWebhookSignature(raw, request.headers.get('x-webhook-signature'), secret)) {
    return Response.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const events =
    payload?.batch === true && Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [payload];
  let processed = 0;
  let ignored = 0;
  let duplicates = 0;
  try {
    for (const event of events) {
      const result = await handleEvent(event);
      if (result === 'processed') processed += 1;
      else if (result === 'duplicate') duplicates += 1;
      else ignored += 1;
    }
  } catch (error) {
    console.error('No se pudo procesar el webhook de Kapso', error instanceof Error ? error.message : 'error desconocido');
    return Response.json({ error: 'No se pudo procesar el mensaje.' }, { status: 500 });
  }

  // Intento inmediato sin bloquear la respuesta (Kapso exige 200 en menos de 10 s).
  // El worker reintenta lo que quede pendiente.
  void processWhatsAppQueue(5).catch((error) => {
    console.error('No se pudo procesar la cola de WhatsApp', error instanceof Error ? error.message : 'error desconocido');
  });

  return Response.json({ ok: true, processed, ignored, duplicates });
}
