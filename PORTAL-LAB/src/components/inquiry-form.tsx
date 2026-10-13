"use client";
import { useState, type FormEvent } from "react";
export default function InquiryForm({
  listingId,
  agency,
}: {
  listingId: string;
  agency: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          message: data.get("message"),
          consent: data.get("consent") === "on",
          website: data.get("website"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setSent(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos enviar tu consulta.",
      );
    } finally {
      setBusy(false);
    }
  }
  return sent ? (
    <div className="success" role="status">
      <h3>Tu consulta quedó guardada.</h3>
      <p>
        {agency} la recibirá en su CRM para contactarte. No hace falta enviarla
        otra vez.
      </p>
    </div>
  ) : (
    <form className="inquiry-form" onSubmit={submit}>
      <h3>¿Te imaginás acá?</h3>
      <p>
        Consultá a <strong>{agency}</strong>
      </p>
      <label>
        Tu nombre
        <input name="name" required maxLength={150} autoComplete="name" />
      </label>
      <label>
        Correo electrónico
        <input name="email" type="email" maxLength={254} autoComplete="email" />
      </label>
      <label>
        Teléfono
        <input name="phone" type="tel" maxLength={40} autoComplete="tel" />
      </label>
      <small>Completá al menos un correo o teléfono.</small>
      <label>
        Tu mensaje
        <textarea
          name="message"
          required
          maxLength={5000}
          rows={4}
          defaultValue="Hola, me interesa esta propiedad. Quisiera recibir más información."
        />
      </label>
      <div className="honeypot" aria-hidden="true">
        <label>
          Sitio web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="consent">
        <input name="consent" type="checkbox" required />
        <span>
          Autorizo a compartir mi consulta y mis datos de contacto con {agency}.{" "}
          <a href="/privacidad">Privacidad</a>
        </span>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? "Enviando…" : "Enviar consulta ↗"}
      </button>
    </form>
  );
}
