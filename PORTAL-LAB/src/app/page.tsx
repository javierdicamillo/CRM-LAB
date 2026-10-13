import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Search,
  MapPin,
  ScanLine,
  Building2,
} from "lucide-react";
import { catalog } from "@/lib/catalog";
import { propertyTypes } from "@/lib/format";
import Card from "@/components/card";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  let result;
  let unavailable = false;
  try {
    result = await catalog(p);
  } catch {
    unavailable = true;
  }
  const pageUrl = (page: number) =>
    "/?" +
    new URLSearchParams(
      Object.entries({ ...p, page: String(page) }).filter(
        (e): e is [string, string] => typeof e[1] === "string",
      ),
    ).toString() +
    "#catalogo";
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="dot" /> NEUQUÉN · PATAGONIA ARGENTINA
          </span>
          <h1>
            Tu próximo lugar.
            <br />
            <em>Conectado al territorio.</em>
          </h1>
          <p>
            Encontrá una casa, un proyecto, una nueva etapa.
            <br />
            Propiedades de inmobiliarias locales en un mismo lugar.
          </p>
          <a className="hero-action" href="#catalogo">
            Explorá las propiedades <ArrowDown size={17} />
          </a>
        </div>
        <div className="territory-art" aria-hidden="true">
          <img
            className="architecture-hero"
            src="/demo-architecture/house.webp"
            alt=""
          />
          <div className="art-caption">
            <ScanLine size={20} />
            <span>
              Arquitectura para imaginar.
              <br />
              <strong>Imagen ilustrativa · generada con IA.</strong>
            </span>
          </div>
        </div>
      </section>
      <section className="catalog-section" id="catalogo">
        <div className="section-title">
          <div>
            <span className="eyebrow">EXPLORÁ NUEVAS POSIBILIDADES</span>
            <h2>Encontrá tu lugar</h2>
          </div>
          <span className="results-count">
            {result
              ? `${result.count} propiedades disponibles`
              : "Catálogo inmobiliario"}
          </span>
        </div>
        <form className="search-form" action="/#catalogo">
          <label className="search-text">
            <span>¿Dónde querés estar?</span>
            <div>
              <Search size={18} />
              <input
                name="q"
                defaultValue={p.q}
                placeholder="Ciudad, barrio o propiedad"
                maxLength={100}
              />
            </div>
          </label>
          <label>
            <span>Operación</span>
            <select name="operation" defaultValue={p.operation ?? ""}>
              <option value="">Venta y alquiler</option>
              <option value="sale">Comprar</option>
              <option value="rent">Alquilar</option>
            </select>
          </label>
          <label>
            <span>Tipo de propiedad</span>
            <select name="type" defaultValue={p.type ?? ""}>
              <option value="">Todos los tipos</option>
              {Object.entries(propertyTypes).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary">
            Buscar <ArrowUpRight size={17} />
          </button>
        </form>
        {unavailable ? (
          <div className="empty" role="alert">
            <Building2 size={34} />
            <h3>No pudimos cargar el catálogo</h3>
            <p>Intentá nuevamente en unos minutos.</p>
            <Link className="secondary" href="/">
              Volver a intentar
            </Link>
          </div>
        ) : result?.rows.length ? (
          <>
            <div className="property-grid">
              {result.rows.map((row) => (
                <Card key={row.id} row={row} />
              ))}
            </div>
            <nav className="pagination" aria-label="Páginas del catálogo">
              {result.page > 1 && (
                <Link href={pageUrl(result.page - 1)}>← Anterior</Link>
              )}
              <span>
                Página {result.page} de {result.pages}
              </span>
              {result.page < result.pages && (
                <Link href={pageUrl(result.page + 1)}>Siguiente →</Link>
              )}
            </nav>
          </>
        ) : (
          <div className="empty">
            <MapPin size={36} />
            <h3>
              {p.q || p.type || p.operation
                ? "No encontramos propiedades con esos filtros"
                : "Nuevas oportunidades, próximamente"}
            </h3>
            <p>
              {p.q || p.type || p.operation
                ? "Probá otra ciudad o ampliá la búsqueda."
                : "Las inmobiliarias están preparando sus primeras publicaciones."}
            </p>
            {(p.q || p.type || p.operation) && (
              <Link className="secondary" href="/#catalogo">
                Ver todo el catálogo
              </Link>
            )}
          </div>
        )}
      </section>
      <section className="territory-strip">
        <span className="strip-icon">
          <ScanLine size={32} />
        </span>
        <div>
          <span className="eyebrow">MÁS CONTEXTO PARA ELEGIR</span>
          <h2>Conocé el lugar, desde su parcela.</h2>
          <p>
            Las fichas autorizadas pueden mostrar su referencia catastral y el
            contorno consultado en la cartografía pública de Neuquén.
          </p>
        </div>
        <Link href="/territorio">
          Cómo funciona <ArrowUpRight size={18} />
        </Link>
      </section>
    </main>
  );
}
