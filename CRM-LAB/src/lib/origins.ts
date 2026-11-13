// Orígenes permitidos de la instalación. En local se aceptan tanto
// localhost como 127.0.0.1 para evitar rechazos al abrir la app por IP.
export function trustedOrigins() {
  const raw = process.env.BETTER_AUTH_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    const origins = new Set<string>([url.origin]);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      for (const host of ['localhost', '127.0.0.1']) {
        const alternate = new URL(url.origin);
        alternate.hostname = host;
        origins.add(alternate.origin);
      }
    }
    return [...origins];
  } catch {
    return [];
  }
}
export function isTrustedOrigin(origin: string | null) {
  return origin !== null && trustedOrigins().includes(origin);
}
