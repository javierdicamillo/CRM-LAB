import { actor, failure, limited, ApiError } from '@/lib/security';
import { lookupParcel, CadastreError } from '../../../../../contracts/cadastre';
export async function GET(request:Request) {
  try {await actor(request);await limited(request,'cadastre',40);const value=new URL(request.url).searchParams.get('nomenclature')??'';return Response.json(await lookupParcel(value),{headers:{'Cache-Control':'no-store'}});}
  catch(error) {return failure(error instanceof CadastreError?new ApiError(error.status,error.message):error);}
}
