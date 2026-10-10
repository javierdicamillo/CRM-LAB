import { z } from 'zod';
import { actor,sameOrigin,jsonBody,failure } from '@/lib/security';
import { saveRecord,publish } from '@/lib/business';
const inputSchema=z.object({kind:z.enum(['contact','property','offer','opportunity','activity']),id:z.uuid().optional(),version:z.number().int().positive().optional(),data:z.unknown()}).strict();
export async function POST(request:Request) {
  try {sameOrigin(request);const user=await actor(request);const input=inputSchema.parse(await jsonBody(request));
    return Response.json(await saveRecord(user.id,input.kind,input.data,input.id,input.version));
  }catch(error){return failure(error);}
}
export async function PATCH(request:Request) {
  try {sameOrigin(request);const user=await actor(request);const input=z.object({id:z.uuid(),status:z.enum(['published','withdrawn']),version:z.number().int().positive()}).strict().parse(await jsonBody(request));
    await publish(user.id,input.id,input.status,input.version);return Response.json({ok:true});
  }catch(error){return failure(error);}
}
