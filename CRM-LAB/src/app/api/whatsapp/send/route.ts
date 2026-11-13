import { z } from 'zod';
import { actor,sameOrigin,jsonBody,failure,limited,ApiError } from '@/lib/security';
import { pool,transaction,audit } from '@/lib/db';
import { KapsoError,kapsoConfigured,sendWhatsAppText } from '@/lib/kapso';
export const dynamic='force-dynamic';

export async function POST(request:Request) {
  try {
    sameOrigin(request);
    const user=await actor(request);
    await limited(request,'whatsapp',20);
    if(!kapsoConfigured()) throw new ApiError(503,'WhatsApp no está configurado. Revisá KAPSO_API_KEY y KAPSO_PHONE_NUMBER_ID.');

    const input=z.object({contactId:z.uuid(),text:z.string().trim().min(1).max(4096)}).strict().parse(await jsonBody(request));
    const contact=(await pool.query("SELECT data FROM records WHERE id=$1 AND kind='contact'",[input.contactId])).rows[0];
    if(!contact) throw new ApiError(404,'Contacto inexistente.');
    if(!contact.data?.phone) throw new ApiError(400,'El contacto no tiene teléfono.');

    let result;
    try {
      result=await sendWhatsAppText(contact.data.phone,input.text);
    } catch(error) {
      if(error instanceof KapsoError) {
        if(error.status===0) throw new ApiError(503,error.detail);
        if(error.status===422&&/24-hour window/i.test(error.detail)) throw new ApiError(409,'El destinatario debe escribir primero por WhatsApp para abrir la ventana de 24 horas.');
        if(error.status===429) throw new ApiError(429,'WhatsApp limitó los envíos. Esperá unos minutos y reintentá.');
        if(error.status===401) throw new ApiError(503,'Kapso rechazó la autenticación. Revisá la API key.');
        if(error.status===403&&/sandbox session/i.test(error.detail)) throw new ApiError(409,'El destinatario no tiene una sesión activa en el sandbox de Kapso. En Kapso, andá a WhatsApp → Sandbox, agregá ese teléfono y enviá el código de activación desde ese mismo teléfono al número del sandbox.');
        if(error.status===403) throw new ApiError(403,error.detail||'Kapso rechazó la operación.');
        if(error.status===400) throw new ApiError(400,error.detail);
        throw new ApiError(502,'No se pudo enviar el mensaje por WhatsApp. Volvé a intentarlo.');
      }
      throw error;
    }

    // El mensaje ya salió: un fallo de auditoría no debe provocar un reintento duplicado.
    await transaction(async c=>{await audit(c,user.id,'whatsapp.sent',input.contactId);})
      .catch(error=>{console.error('No se pudo auditar el envío de WhatsApp',error instanceof Error?error.name:'unknown');});

    return Response.json({ok:true,messageId:result.messageId});
  }catch(error){return failure(error);}
}
