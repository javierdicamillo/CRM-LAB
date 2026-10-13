import {
  CADASTRE_SOURCE,
  CADASTRE_VIEWER,
} from "../../../../../contracts/cadastre";
export default function Territory() {
  return (
    <main className="prose">
      <span className="eyebrow">CATASTRO Y TERRITORIO</span>
      <h1>
        Una referencia concreta.
        <br />
        Más contexto para elegir.
      </h1>
      <p>
        PORTAL LAB relaciona las propiedades con las parcelas públicas de la
        provincia de Neuquén a través de su nomenclatura catastral.
      </p>
      <h2>Cómo se vincula una propiedad</h2>
      <ol>
        <li>
          La inmobiliaria ingresa en su CRM la nomenclatura de parcela de 15
          dígitos.
        </li>
        <li>
          Se consulta la capa oficial «Parcelas» de la Dirección Provincial de
          Catastro e Información Territorial.
        </li>
        <li>
          Cuando existe una coincidencia única, se conserva el contorno y la
          fecha de consulta.
        </li>
        <li>
          La inmobiliaria decide si autoriza que esa referencia y su ubicación
          exacta aparezcan en la ficha pública.
        </li>
      </ol>
      <h2>Qué significa la referencia</h2>
      <p>
        Permite identificar una parcela en la cartografía. La relación entre esa
        parcela y el inmueble ofrecido es declarada por la inmobiliaria. En
        edificios o propiedades horizontales, la parcela no identifica por sí
        sola una unidad funcional.
      </p>
      <p>
        La consulta no acredita dominio, titularidad ni aptitud urbanística. La
        superficie comercial del anuncio es informada por la inmobiliaria y
        puede diferir de la parcela. La cartografía es una consulta fechada, no
        una certificación ni una actualización en tiempo real.
      </p>
      <h2>Fuentes públicas</h2>
      <p>
        <a href={CADASTRE_SOURCE}>
          Servicio cartográfico oficial · Parcelas ↗
        </a>
      </p>
      <p>
        <a href={CADASTRE_VIEWER}>Visor oficial ITC ↗</a>
      </p>
      <p>
        <a href="https://dpc.neuquen.gov.ar/Home/SistemaITC">
          Información oficial sobre acceso público al sistema ↗
        </a>
      </p>
    </main>
  );
}
