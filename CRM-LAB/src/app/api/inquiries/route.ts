import { z } from 'zod';
import { actor,sameOrigin,jsonBody,failure } from '@/lib/security';
import { importInquiry } from '@/lib/business';
export async function POST(request:Request) {
  try {sameOrigin(request);await actor(request,true);const input=await jsonBody(request);return Response.json(await importInquiry(z.uuid().parse(input.portalId),input.inquiry));}
  catch(error){return failure(error);}
}
