const API_BASE = (process.env.KAPSO_API_BASE_URL ?? 'https://api.kapso.ai').replace(/\/+$/, '');
const API_VERSION = process.env.KAPSO_API_VERSION ?? 'v24.0';

export type KapsoSendResult = { messageId: string | null };

export class KapsoError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'KapsoError';
    this.status = status;
    this.detail = detail;
  }
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function kapsoPhoneNumberId(): string | undefined {
  return env('KAPSO_PHONE_NUMBER_ID') ?? env('KAPSO_SANDBOX_PHONE_ID');
}

export function kapsoConfigured(): boolean {
  return Boolean(env('KAPSO_API_KEY') && kapsoPhoneNumberId());
}

export function normalizeWhatsAppRecipient(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new KapsoError(400, 'El teléfono debe tener entre 8 y 15 dígitos en formato internacional, sin "+".');
  }
  return digits;
}

export async function sendWhatsAppText(to: string, text: string): Promise<KapsoSendResult> {
  const apiKey = env('KAPSO_API_KEY');
  const phoneNumberId = kapsoPhoneNumberId();
  if (!apiKey) throw new KapsoError(0, 'Falta KAPSO_API_KEY.');
  if (!phoneNumberId) throw new KapsoError(0, 'Falta KAPSO_PHONE_NUMBER_ID (o KAPSO_SANDBOX_PHONE_ID).');
  if (!/^\d+$/.test(phoneNumberId)) {
    throw new KapsoError(0, 'KAPSO_PHONE_NUMBER_ID debe ser el phone_number_id numérico de Meta.');
  }

  const body = text.trim();
  if (!body) throw new KapsoError(400, 'El mensaje no puede estar vacío.');
  if (body.length > 4096) throw new KapsoError(400, 'El mensaje supera los 4096 caracteres.');
  const recipient = normalizeWhatsAppRecipient(to);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/meta/whatsapp/${API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { body },
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new KapsoError(0, 'No se pudo conectar con Kapso. Revisá la conexión e intentá de nuevo.');
  }

  const raw = await response.text();
  let payload: any = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const detail = typeof payload?.error === 'string'
      ? payload.error
      : payload?.error?.message ?? raw.slice(0, 500) ?? `HTTP ${response.status}`;
    throw new KapsoError(response.status, detail || `HTTP ${response.status}`);
  }

  return {
    messageId: payload.messages?.[0]?.id ?? payload.data?.messages?.[0]?.id ?? payload.data?.id ?? null,
  };
}
