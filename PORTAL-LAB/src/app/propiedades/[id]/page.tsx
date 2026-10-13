import Link from "next/link";
import { notFound } from "next/navigation";
import { publicListing } from "@/lib/catalog";
import { propertyTypes, money } from "@/lib/format";
import ParcelMap from "@/components/parcel-map";
import InquiryForm from "@/components/inquiry-form";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const row = await publicListing((await params).id);
  return {
    title: row?.listing.title ?? "Propiedad no disponible",
    description: row?.listing.description.slice(0, 160),
  };
}
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const row = await publicListing((await params).id);
  if (!row) notFound();
  const l = row.listing,
    p = row.parcel;
  return (
    <main className="detail">
      <Link className="back-link" href="/#catalogo">
        ← Volver al catálogo
      </Link>
      <div className="detail-heading">
        <div>
          <span className="eyebrow">
            {propertyTypes[l.property_type]} ·{" "}
            {l.operation === "sale" ? "VENTA" : "ALQUILER"}
          </span>
          <h1>{l.title}</h1>
          <p className="muted">
            {[
              l.location.public_address,
              l.location.neighborhood,
              l.location.city,
              l.location.region,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <strong className="detail-price">
          {money(l.price)}
          <small>
            {l.price.period === "month"
              ? "por mes"
              : l.price.period === "day"
                ? "por día"
                : ""}
          </small>
        </strong>
      </div>
      <div className="gallery">
        {l.media_ids.map((id: string, i: number) => (
          <a key={id} href={`/media/${id}`} target="_blank" rel="noreferrer">
            <img
              src={`/media/${id}`}
              alt={`${l.title} · imagen ${i + 1}`}
              loading={i ? "lazy" : "eager"}
            />
          </a>
        ))}
      </div>
      <div className="detail-columns">
        <div>
          <div className="detail-features">
            <div>
              <strong>{l.area_m2 ?? "—"} m²</strong>
              <span>Superficie informada</span>
            </div>
            <div>
              <strong>{l.bedrooms ?? "—"}</strong>
              <span>Dormitorios</span>
            </div>
            <div>
              <strong>{l.bathrooms ?? "—"}</strong>
              <span>Baños</span>
            </div>
          </div>
          <section className="detail-section">
            <h2>Un lugar para tu próxima etapa</h2>
            <p className="description">{l.description}</p>
          </section>
          <section className="detail-section">
            <span className="eyebrow">CATASTRO DE NEUQUÉN</span>
            <h2>La propiedad en el territorio</h2>
            {p ? (
              <>
                <p>
                  Nomenclatura de parcela <strong>{p.nomenclature}</strong>
                </p>
                <ParcelMap parcel={p} />
                <dl className="parcel-data">
                  <div>
                    <dt>Localidad catastral</dt>
                    <dd>{p.locality || "No informada"}</dd>
                  </div>
                  <div>
                    <dt>Departamento</dt>
                    <dd>{p.department || "No informado"}</dd>
                  </div>
                  <div>
                    <dt>Tipo de parcela</dt>
                    <dd>{p.parcelType || "No informado"}</dd>
                  </div>
                  <div>
                    <dt>Consulta realizada</dt>
                    <dd>
                      {new Date(p.checkedAt).toLocaleDateString("es-AR", {
                        timeZone: "America/Argentina/Buenos_Aires",
                      })}
                    </dd>
                  </div>
                </dl>
                <p className="small muted">
                  Vinculación declarada por la inmobiliaria y consultada en la{" "}
                  <a href={p.source}>cartografía pública DPCeIT</a>. El contorno
                  corresponde a la parcela, no necesariamente a la unidad en
                  venta. No acredita titularidad, medidas de la unidad ni estado
                  jurídico.
                </p>
              </>
            ) : (
              <div className="notice">
                Esta ficha no tiene una referencia catastral pública autorizada.
                Consultá a la inmobiliaria para conocer más detalles.
              </div>
            )}
          </section>
        </div>
        <aside className="contact-panel">
          <Link className="agency-name" href={`/inmobiliarias/${row.slug}`}>
            {row.agency} ↗
          </Link>
          <InquiryForm listingId={row.id} agency={row.agency} />
        </aside>
      </div>
    </main>
  );
}
