"use client";
import { useState } from "react";
import type { Parcel } from "../../../contracts/cadastre";
export default function ParcelMap({ parcel }: { parcel: Parcel }) {
  const [zoom, setZoom] = useState(1);
  const points = parcel.geometry.coordinates.flat(),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const midX = (minX + maxX) / 2,
    midY = (minY + maxY) / 2,
    cos = Math.cos((midY * Math.PI) / 180);
  const scale = Math.min(
    480 / Math.max((maxX - minX) * cos, 0.000001),
    260 / Math.max(maxY - minY, 0.000001),
  );
  const path = parcel.geometry.coordinates
    .map(
      (r) =>
        r
          .map(
            (p, i) =>
              `${i ? "L" : "M"}${300 + (p[0] - midX) * cos * scale} ${170 - (p[1] - midY) * scale}`,
          )
          .join(" ") + "Z",
    )
    .join(" ");
  return (
    <div className="parcel-map">
      <svg
        viewBox="0 0 600 340"
        role="img"
        aria-label={`Contorno catastral de la parcela ${parcel.nomenclature}`}
      >
        <defs>
          <pattern
            id="parcel-grid"
            width="30"
            height="30"
            patternUnits="userSpaceOnUse"
          >
            <path d="M30 0H0V30" fill="none" stroke="#dbe2d9" />
          </pattern>
        </defs>
        <rect width="600" height="340" fill="url(#parcel-grid)" />
        <g transform={`translate(300 170) scale(${zoom}) translate(-300 -170)`}>
          <path
            d={path}
            fill="#527965"
            fillOpacity=".16"
            stroke="#315747"
            strokeWidth={2 / zoom}
            fillRule="evenodd"
          />
        </g>
        <text x="563" y="35" fontSize="13" fill="#315747">
          N ↑
        </text>
      </svg>
      <div className="map-controls">
        <button
          type="button"
          aria-label="Alejar parcela"
          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Restablecer vista"
          onClick={() => setZoom(1)}
        >
          1:1
        </button>
        <button
          type="button"
          aria-label="Acercar parcela"
          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
        >
          +
        </button>
      </div>
      <a
        className="map-link"
        href={`https://www.openstreetmap.org/?mlat=${midY}&mlon=${midX}#map=17/${midY}/${midX}`}
        target="_blank"
        rel="noreferrer"
      >
        Ver el entorno en OpenStreetMap ↗
      </a>
    </div>
  );
}
