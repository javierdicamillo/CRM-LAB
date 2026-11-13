// Normalización mínima para el piloto argentino: sin selector de país.
// Acepta formatos locales y agrega +54 9 cuando el número no trae país.
export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return "";

  // Formato local con 0 inicial: 011 6706-2068 -> 5491167062068
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Número argentino sin país (10 dígitos): área + abonado.
  if (digits.length === 10) return `549${digits}`;

  // Número argentino con país pero sin el 9 de móvil: 54 + 10 dígitos.
  if (digits.length === 12 && digits.startsWith("54")) {
    return `549${digits.slice(2)}`;
  }

  return digits;
}

export function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value);
  return digits.length >= 8 && digits.length <= 15;
}
