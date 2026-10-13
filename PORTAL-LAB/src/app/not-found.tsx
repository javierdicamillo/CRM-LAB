import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty">
      <h1>Esta propiedad no está disponible.</h1>
      <p>Puede haberse retirado o estar pendiente de actualización.</p>
      <Link className="primary" href="/">
        Explorar el catálogo
      </Link>
    </main>
  );
}
