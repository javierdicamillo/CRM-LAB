"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type * as Leaflet from "leaflet";
import type { Parcel } from "../../../contracts/cadastre";
import { money, propertyTypes } from "@/lib/format";
type Row = {
  id: string;
  agency: string;
  parcel: Parcel | null;
  listing: {
    title: string;
    operation: string;
    property_type: string;
    price: { amount: string; currency: string };
    location: { city: string; neighborhood?: string };
  };
};
export default function Explorer({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState("");
  const [operation, setOperation] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const node = useRef<HTMLDivElement>(null);
  const engine = useRef<{ L: typeof Leaflet; map: Leaflet.Map } | null>(null);
  const layers = useRef(new Map<string, Leaflet.FeatureGroup>());
  const reset = useRef<() => void>(() => {});
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!operation || r.listing.operation === operation) &&
          (!type || r.listing.property_type === type) &&
          `${r.listing.title} ${r.listing.location.city} ${r.listing.location.neighborhood ?? ""} ${r.parcel?.nomenclature ?? ""}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase().trim()),
      ),
    [rows, search, operation, type],
  );
  const mapped = filtered.filter((r) => r.parcel);
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    import("leaflet")
      .then((L) => {
        if (cancelled || !node.current) return;
        const map = L.map(node.current, { minZoom: 5, maxZoom: 19 }).setView(
          [-38.6, -70.1],
          7,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          referrerPolicy: "strict-origin-when-cross-origin",
        })
          .on("tileerror", () =>
            setError(
              "El mapa de fondo no está disponible. Podés seguir explorando las parcelas y las fichas.",
            ),
          )
          .addTo(map);
        L.control.scale({ imperial: false }).addTo(map);
        engine.current = { L, map };
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(node.current);
        cleanup = () => {
          observer.disconnect();
          map.remove();
          engine.current = null;
        };
        setReady(true);
      })
      .catch(() =>
        setError(
          "No se pudo iniciar el mapa. Las publicaciones siguen disponibles en el listado.",
        ),
      );
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);
  useEffect(() => {
    if (!ready || !engine.current) return;
    const { L, map } = engine.current;
    const group = L.featureGroup().addTo(map);
    layers.current.clear();
    // A single popup lists every publication sharing a parcel, including units.
    const parcels = new Map<string, Row[]>();
    filtered.forEach((r) => {
      if (r.parcel)
        parcels.set(r.parcel.nomenclature, [
          ...(parcels.get(r.parcel.nomenclature) ?? []),
          r,
        ]);
    });
    parcels.forEach((items) => {
      const parcel = items[0].parcel!;
      const polygon = L.polygon(
        parcel.geometry.coordinates.map((ring) =>
          ring.map((p) => [p[1], p[0]] as Leaflet.LatLngTuple),
        ),
        {
          color: "#315747",
          weight: 3,
          fillColor: "#e6bc78",
          fillOpacity: 0.45,
        },
      );
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `Parcela ${parcel.nomenclature}`;
      content.append(title);
      items.forEach((r) => {
        const link = document.createElement("a");
        link.href = `/propiedades/${r.id}`;
        link.textContent = `${r.listing.title} · ${money(r.listing.price)} ↗`;
        link.className = "parcel-popup-link";
        content.append(link);
      });
      const layer = L.featureGroup([
        polygon,
        L.circleMarker(polygon.getBounds().getCenter(), {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#315747",
          fillOpacity: 1,
        }),
      ])
        .bindPopup(content)
        .addTo(group);
      layer.on("click", () => setSelected(items[0].id));
      items.forEach((r) => layers.current.set(r.id, layer));
    });
    reset.current = () => {
      if (group.getBounds().isValid())
        map.fitBounds(group.getBounds(), { padding: [45, 45], maxZoom: 16 });
      else map.setView([-38.6, -70.1], 7);
    };
    reset.current();
    setSelected(null);
    return () => {
      group.remove();
      layers.current.clear();
    };
  }, [filtered, ready]);
  function focus(row: Row) {
    setSelected(row.id);
    const layer = layers.current.get(row.id);
    if (layer && engine.current) {
      engine.current.map.fitBounds(layer.getBounds(), {
        padding: [60, 60],
        maxZoom: 17,
      });
      layer.openPopup(layer.getBounds().getCenter());
    }
  }
  return (
    <>
      <div className="explorer-filters">
        <label>
          Buscar
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Localidad, título o nomenclatura"
          />
        </label>
        <label>
          Operación
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="sale">Venta</option>
            <option value="rent">Alquiler</option>
          </select>
        </label>
        <label>
          Tipo de propiedad
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(propertyTypes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            setSearch("");
            setOperation("");
            setType("");
          }}
        >
          Limpiar filtros
        </button>
      </div>
      <p className="map-summary" aria-live="polite">
        {filtered.length} publicaciones · {mapped.length} con parcela en el mapa
        · {filtered.length - mapped.length} sin parcela pública
      </p>
      <div className="explorer-layout">
        <section
          className="explorer-results"
          aria-label="Publicaciones del mapa"
        >
          {filtered.length === 0 && (
            <p className="map-empty">
              No hay publicaciones para estos filtros.
            </p>
          )}
          {filtered.map((row) => (
            <article
              key={row.id}
              className={`map-result ${selected === row.id ? "is-selected" : ""}`}
            >
              <span className="eyebrow">
                {row.listing.operation === "sale" ? "VENTA" : "ALQUILER"} ·{" "}
                {propertyTypes[row.listing.property_type]}
              </span>
              <h2>
                <Link href={`/propiedades/${row.id}`}>{row.listing.title}</Link>
              </h2>
              <p>
                {row.listing.location.city} · {row.agency}
              </p>
              <strong>{money(row.listing.price)}</strong>
              <div className="map-result-actions">
                {row.parcel ? (
                  <button disabled={!ready} onClick={() => focus(row)}>
                    Ver parcela
                  </button>
                ) : (
                  <span>Sin parcela pública</span>
                )}
                <Link href={`/propiedades/${row.id}`}>Ver ficha ↗</Link>
              </div>
            </article>
          ))}
        </section>
        <section
          className="explorer-canvas"
          aria-label="Mapa de publicaciones con parcelas"
        >
          <div
            ref={node}
            className="geographic-map"
            aria-label="Mapa interactivo de Neuquén"
          />
          <button
            className="map-fit"
            disabled={!ready}
            onClick={() => reset.current()}
          >
            Ver todas las parcelas
          </button>
          {(!ready || error || mapped.length === 0) && (
            <p className="map-status" role="status">
              {error ||
                (!ready
                  ? "Cargando mapa…"
                  : "No hay parcelas públicas para estos filtros. Consultá las fichas en el listado.")}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
