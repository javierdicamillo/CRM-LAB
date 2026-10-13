/** Public, read-only DPCeIT parcel service. Never request owners or title records. */
export const CADASTRE_SOURCE = 'https://catastro.neuquen.gov.ar/server/rest/services/IDE/Catastro/MapServer/4';
export const CADASTRE_VIEWER = 'https://catastro.neuquen.gov.ar/itc';
export type Parcel = {
  nomenclature: string; objectId: number; locality: string; department: string;
  parcelType: string; source: string; checkedAt: string;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
};
export class CadastreError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function normalizeNomenclature(value: string) {
  const result = value.trim().replace(/[\s.-]/g, '');
  if (!/^\d{15}$/.test(result)) throw new CadastreError(400, 'Ingresá los 15 dígitos de la nomenclatura de la parcela (sin unidad funcional).');
  return result;
}
export async function lookupParcel(value: string, fetcher: typeof fetch = fetch): Promise<Parcel> {
  const nomenclature = normalizeNomenclature(value);
  const url = new URL(`${CADASTRE_SOURCE}/query`);
  url.search = new URLSearchParams({ f: 'json', where: `PAR_NOMENCLATURA='${nomenclature}'`,
    outFields: 'OBJECTID,PAR_NOMENCLATURA,LOCALIDAD,DEPARTAMENTO,TIPO_PARCELA',
    returnGeometry: 'true', outSR: '4326', resultRecordCount: '2' }).toString();
  let body: any;
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(12000), redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error('upstream');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('empty');
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength;
      if (size > 2000000) throw new Error('large'); chunks.push(value); } }
    finally { await reader.cancel(); }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (body.error || !Array.isArray(body.features)) throw new Error('upstream');
  } catch { throw new CadastreError(503, 'Catastro de Neuquén no respondió. Intentá nuevamente más tarde.'); }
  if (!body.features.length) throw new CadastreError(404, 'No se encontró esa parcela en la capa pública de Catastro.');
  if (body.features.length !== 1 || body.exceededTransferLimit) throw new CadastreError(409, 'La nomenclatura no identifica una única parcela. Requiere revisión.');
  const { attributes: a, geometry: g } = body.features[0];
  const rings = g?.rings;
  if (a?.PAR_NOMENCLATURA !== nomenclature || !Number.isSafeInteger(a.OBJECTID) || body.spatialReference?.wkid !== 4326 ||
      !Array.isArray(rings) || !rings.length || rings.length > 1000 ||
      !rings.every((ring: any) => Array.isArray(ring) && ring.length >= 4 && ring.length <= 20000 &&
        ring.every((p: any) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= -73 && p[0] <= -67 && p[1] >= -42 && p[1] <= -35) &&
        ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]))
    throw new CadastreError(503, 'Catastro devolvió una geometría o referencia inesperada. No se vinculó la parcela.');
  return { nomenclature, objectId: a.OBJECTID, locality: String(a.LOCALIDAD ?? '').slice(0,180),
    department: String(a.DEPARTAMENTO ?? '').slice(0,180), parcelType: String(a.TIPO_PARCELA ?? '').slice(0,100),
    source: CADASTRE_SOURCE, checkedAt: new Date().toISOString(), geometry: { type: 'Polygon', coordinates: rings } };
}
