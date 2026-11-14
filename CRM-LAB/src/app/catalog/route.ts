import { ApiError, failure, limited, validToken } from '@/lib/security';
import { catalogParams, searchCatalog } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const secret = process.env.CATALOG_TOKEN;
    if (!secret) throw new ApiError(503, 'Catálogo no configurado.');
    await limited(request, 'catalog', 120);
    const [scheme, value] = (request.headers.get('authorization') ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !validToken(value ?? '', secret)) {
      throw new ApiError(401, 'Token de catálogo inválido.');
    }
    const result = await searchCatalog(catalogParams(new URL(request.url).searchParams));
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = failure(error);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
