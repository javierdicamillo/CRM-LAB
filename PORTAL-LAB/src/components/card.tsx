import Link from "next/link";
import { ArrowUpRight, MapPin, ScanLine } from "lucide-react";
import { money, propertyTypes } from "@/lib/format";
export default function Card({ row }: { row: any }) {
  const l = row.listing;
  return (
    <article className="property-card">
      <Link className="cover" href={`/propiedades/${row.id}`}>
        <img src={`/media/${l.media_ids[0]}`} alt={l.title} loading="lazy" />
        <span className="operation">
          {l.operation === "sale" ? "En venta" : "En alquiler"}
        </span>
        <span className="cover-arrow">
          <ArrowUpRight size={20} />
        </span>
      </Link>
      <div className="card-body">
        <div className="card-meta">
          {propertyTypes[l.property_type]}
          {row.parcel && (
            <span title="Parcela vinculada a una consulta pública">
              <ScanLine size={13} />
              Ref. catastral
            </span>
          )}
        </div>
        <Link href={`/propiedades/${row.id}`}>
          <h3>{l.title}</h3>
        </Link>
        <p className="muted location">
          <MapPin size={14} />
          {[l.location.neighborhood, l.location.city]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="features">
          <span>{l.area_m2 ?? "—"} m²</span>
          <span>{l.bedrooms ?? "—"} dorm.</span>
          <span>{l.bathrooms ?? "—"} baños</span>
        </div>
        <div className="card-bottom">
          <strong>
            {money(l.price)}
            <small>
              {l.price.period === "month"
                ? " / mes"
                : l.price.period === "day"
                  ? " / día"
                  : ""}
            </small>
          </strong>
          <Link href={`/inmobiliarias/${row.slug}`}>{row.agency}</Link>
        </div>
      </div>
    </article>
  );
}
