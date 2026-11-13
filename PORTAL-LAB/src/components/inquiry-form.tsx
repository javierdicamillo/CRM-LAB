"use client";
import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { isValidPhone, normalizePhone } from "@/lib/phone";
const whatsappNumber =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "15557818580";
export default function InquiryForm({
  listingId,
  agency,
  propertyTitle,
}: {
  listingId: string;
  agency: string;
  propertyTitle: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false),
    [phone, setPhone] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const rawPhone = String(data.get("phone") ?? "").trim();
    const normalizedPhone = normalizePhone(rawPhone);
    if (rawPhone && !isValidPhone(rawPhone)) {
      setError("Revisá el teléfono: incluí el código de área o país.");
      return;
    }
    setPhone(normalizedPhone);
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
          phone: normalizedPhone,
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
  const activationText = `Hola, vengo del portal. Me interesa ${propertyTitle}. Quiero consultar por precio, ubicación, requisitos y descripción.`;
  const whatsappLink = phone
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(activationText)}`
    : "";
  return sent ? (
    <div className="success" role="status">
      <h3>Tu consulta quedó guardada.</h3>
      <p>
        {agency} la recibirá en su CRM para contactarte. No hace falta enviarla
        otra vez.
      </p>
      {whatsappLink && (
        <>
          <p>Podés seguir la conversación ahora mismo por WhatsApp:</p>
          <a
            className="primary"
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
          >
            Continuar por WhatsApp <MessageCircle size={16} />
          </a>
          <small>
            Se abrirá WhatsApp con un mensaje listo. Enviálo para que podamos
            responderte por ahí.
          </small>
        </>
      )}
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
        <input
          name="phone"
          type="tel"
          maxLength={40}
          autoComplete="tel"
          inputMode="tel"
          placeholder="299 603-5274"
        />
      </label>
      <small>
        Completá al menos un correo o teléfono. Si dejás teléfono, incluí el
        código de área: lo usamos para responderte por WhatsApp.
      </small>
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
