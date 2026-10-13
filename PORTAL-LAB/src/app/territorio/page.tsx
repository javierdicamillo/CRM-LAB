import Link from "next/link";
import Explorer from "@/components/property-explorer";
import { mapCatalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export const metadata = { title: "Explorar en el mapa" };
export default async function Territory() {
  let rows;
  try {
    rows = await mapCatalog();
  } catch {
    return (
      <main className="prose">
        <h1>Explorar en el mapa</h1>
        <p>
          No pudimos cargar las publicaciones. Intentá nuevamente en unos
          minutos.
        </p>
      </main>
    );
  }
  return (
    <main className="map-page">
      <div className="map-heading">
        <div>
          <span className="eyebrow">NEUQUÉN · PROPIEDADES Y PARCELAS</span>
          <h1>Explorar en el mapa</h1>
          <p>Elegí una publicación y descubrí su lugar en el territorio.</p>
        </div>
        <Link href="/territorio/fuentes">Sobre la referencia catastral ↗</Link>
      </div>
      <Explorer rows={rows} />
      <p className="map-disclaimer">
        Los contornos corresponden a parcelas públicas vinculadas por la
        inmobiliaria; no acreditan titularidad ni identifican necesariamente una
        unidad funcional.
      </p>
    </main>
  );
}
