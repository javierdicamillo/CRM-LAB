import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { catalog } from "@/lib/catalog";
import Card from "@/components/card";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Agency({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params,
    a = (
      await query(
        "SELECT name,phone,email FROM agencies WHERE slug=$1 AND active",
        [slug],
      )
    ).rows[0];
  if (!a) notFound();
  const result = await catalog({ agency: slug, ...(await searchParams) });
  return (
    <main className="catalog-section">
      <Link className="back-link" href="/">
        ← Catálogo
      </Link>
      <span className="eyebrow">INMOBILIARIA INDEPENDIENTE</span>
      <h1>{a.name}</h1>
      <p>
        {a.phone} {a.email}
      </p>
      <h2>{result.count} propiedades disponibles</h2>
      <div className="property-grid">
        {result.rows.map((row) => (
          <Card key={row.id} row={row} />
        ))}
      </div>
      {!result.count && (
        <p className="empty">
          Esta inmobiliaria aún no tiene publicaciones vigentes.
        </p>
      )}
      <nav className="pagination">
        {result.page > 1 && (
          <Link href={`?page=${result.page - 1}`}>← Anterior</Link>
        )}
        <span>
          Página {result.page} de {result.pages}
        </span>
        {result.page < result.pages && (
          <Link href={`?page=${result.page + 1}`}>Siguiente →</Link>
        )}
      </nav>
    </main>
  );
}
