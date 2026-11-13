/**
 * Envío de prueba por Kapso (WhatsApp Cloud API).
 *
 * No forma parte de la aplicación: sirve para verificar credenciales y entrega
 * antes de usar el botón de WhatsApp de la UI.
 *
 * Uso:
 *   npm run whatsapp:test
 *   npm run whatsapp:test -- --text "Mensaje de prueba"
 *   npm run whatsapp:test -- --to 541167062068 --text "Mensaje de prueba"
 *   npm run whatsapp:test -- --dry-run
 */
import { pathToFileURL } from 'node:url';
import { KapsoError, normalizeWhatsAppRecipient, sendWhatsAppText } from '../src/lib/kapso.ts';

function parseArgs(argv: string[]) {
  let to = process.env.TEST_PHONE_NUMBER?.trim() ?? '';
  let text = '';
  let dryRun = false;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--to') to = argv[++index] ?? '';
    else if (arg === '--text') text = argv[++index] ?? '';
    else if (!to) to = arg;
    else text = text ? `${text} ${arg}` : arg;
  }

  return {
    to: normalizeWhatsAppRecipient(to),
    text: text.trim() || 'Mensaje de prueba de la integración de Kapso en CRM-LAB.',
    dryRun,
  };
}

async function main() {
  const { to, text, dryRun } = parseArgs(process.argv.slice(2));
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, to, text }, null, 2));
    return;
  }

  const result = await sendWhatsAppText(to, text);
  console.log(JSON.stringify({ ok: true, to, messageId: result.messageId }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error instanceof KapsoError) {
      const hint = error.status === 422 && /24-hour window/i.test(error.detail)
        ? ' El destinatario debe enviar primero un mensaje al número de WhatsApp del sandbox para abrir la ventana de 24 horas.'
        : error.status === 403 && /sandbox session/i.test(error.detail)
          ? ' Agregá ese teléfono en Kapso → WhatsApp → Sandbox y enviá el código de activación desde ese mismo teléfono al número del sandbox.'
          : '';
      console.error(`Kapso rechazó el envío (HTTP ${error.status || 'config'}): ${error.detail}${hint}`);
    } else {
      console.error(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
    }
    process.exitCode = 1;
  });
}
