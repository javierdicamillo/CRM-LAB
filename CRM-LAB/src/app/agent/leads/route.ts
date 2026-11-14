import { ApiError, failure, jsonBody, limited, validToken } from '@/lib/security';
import { transaction } from '@/lib/db';
import { agentLeadSchema, saveAgentLead } from '@/lib/agent';

export const dynamic = 'force-dynamic';

// Escritura separada del catálogo: /catalog es de solo lectura.
export async function POST(request: Request) {
  try {
    const secret = process.env.AGENT_TOKEN;
    if (!secret) throw new ApiError(503, 'Agente no configurado.');
    await limited(request, 'agent-leads', 60);
    const [scheme, value] = (request.headers.get('authorization') ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !validToken(value ?? '', secret)) {
      throw new ApiError(401, 'Token de agente inválido.');
    }
    const input = agentLeadSchema.parse(await jsonBody(request, 20_000));
    const result = await transaction((client) => saveAgentLead(client, input));
    return Response.json(result, {
      status: result.created ? 201 : 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const response = failure(error);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
