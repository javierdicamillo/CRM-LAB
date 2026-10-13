export const dynamic = "force-dynamic";
export default function Privacy() {
  return (
    <main className="prose">
      <span className="eyebrow">TUS DATOS</span>
      <h1>Consultas con un destino claro.</h1>
      <p>
        Cuando enviás una consulta, guardamos tu nombre, el medio de contacto
        que elijas y tu mensaje para entregarlos a la inmobiliaria indicada en
        la ficha. No se publican en el catálogo.
      </p>
      <h2>Entrega y conservación</h2>
      <p>
        La consulta espera en el portal hasta que el CRM de la inmobiliaria
        confirma su recepción. Las consultas pendientes se conservan hasta la
        entrega; la operación del portal debe revisar las que superen 30 días.
        Después de la confirmación, se conservan siete días para permitir la
        recuperación del CRM y se eliminan mediante el mantenimiento del
        servidor. Los respaldos tienen un plazo de retención independiente.
      </p>
      <p>
        La inmobiliaria conserva su propia copia para el seguimiento comercial.
        Para solicitar acceso, corrección o eliminación, contactá a la
        inmobiliaria mediante los datos de su página; el operador del portal
        deberá atender también la copia pendiente y los respaldos según su
        política de conservación.
      </p>
      <h2>Ubicación catastral</h2>
      <p>
        Solo mostramos nomenclaturas y contornos cuando la inmobiliaria autoriza
        su publicación. No consultamos ni mostramos titulares, documentos de
        identidad o información dominial.
      </p>
      <h2>Contacto del portal</h2>
      {process.env.PORTAL_CONTACT_EMAIL ? (
        <p>
          Para solicitudes relacionadas con tus datos, escribí a{" "}
          <a href={"mailto:" + process.env.PORTAL_CONTACT_EMAIL}>
            {process.env.PORTAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      ) : (
        <p>
          Contactá a la inmobiliaria indicada en la ficha para solicitar ayuda
          con tus datos.
        </p>
      )}
    </main>
  );
}
