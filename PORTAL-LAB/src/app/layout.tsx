import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ArrowUpRight } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "PORTAL LAB · Encontrá tu lugar en Neuquén",
    template: "%s · PORTAL LAB",
  },
  description:
    "Propiedades de inmobiliarias independientes en Neuquén. Venta, alquiler y referencias catastrales públicas autorizadas.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" data-scroll-behavior="smooth">
      <body>
        <header className="header">
          <Link className="brand" href="/">
            <Building2 size={25} />
            <span>
              PORTAL<span className="brand-light"> LAB</span>
            </span>
          </Link>
          <nav aria-label="Principal">
            <Link href="/#catalogo">Explorar propiedades</Link>
            <Link href="/territorio">Explorar en el mapa</Link>
            <a className="crm-link" href="https://open-crm.tech">
              Mi inmobiliaria <ArrowUpRight size={15} />
            </a>
          </nav>
        </header>
        {process.env.PORTAL_LOCAL_DB && (
          <div className="demo-bar">
            VISTA LOCAL DE DESARROLLO · Las propiedades de ejemplo no son
            ofertas reales. Imágenes arquitectónicas ilustrativas generadas con
            IA.
          </div>
        )}
        {children}
        <footer>
          <div className="brand">
            <Building2 size={23} />
            PORTAL LAB
          </div>
          <p>Inmobiliarias independientes. Un territorio compartido.</p>
          <div>
            <Link href="/territorio/fuentes">Fuente catastral</Link>
            <Link href="/privacidad">Privacidad</Link>
            <a href="https://github.com/javierdicamillo/CRM-LAB">
              Código abierto ↗
            </a>
          </div>
          <small>Neuquén, Patagonia Argentina</small>
        </footer>
      </body>
    </html>
  );
}
