/**
 * Cabeceras de seguridad: una sola lista para todos los sitios donde se sirve la app.
 *   - <meta> del HTML (vite.config.ts): el CSP, que también protege el zip usado sin conexión.
 *   - `_headers` de Netlify y `vite preview` (las pruebas e2e las usan también).
 *   - El bloque de Caddy para un servidor propio (lo genera scripts/caddy.ts, ver deploy/README.md).
 */

/**
 * Política de seguridad del contenido: la app no puede hacer NINGUNA petición de red
 * (connect-src 'none') ni cargar recursos externos. Solo en build: el servidor de desarrollo
 * necesita su websocket de recarga.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React Flow posiciona nodos con estilos en línea
  "font-src 'self'",
  "img-src 'self' data:",
  "worker-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** El CSP más lo que solo funciona como cabecera: frame-ancestors (nadie puede meter la app en un iframe). */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': `${CSP}; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
};

/** Los ficheros de /assets/ llevan su hash en el nombre: nunca cambian. */
export const ASSETS_CACHE = 'public, max-age=31536000, immutable';

/** Fichero `_headers` de Netlify. */
export function netlifyHeaders(): string {
  const block = (headers: Record<string, string>) => Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`).join('\n');
  return `/*\n${block(SECURITY_HEADERS)}\n\n/assets/*\n${block({ 'Cache-Control': ASSETS_CACHE })}\n`;
}

/**
 * Bloque de sitio para Caddy. Sirve la versión enlazada en `<root>/actual` tal cual (sin inyectar
 * nada: la web publicada es idéntica al build), con HTTPS automático y HSTS (Netlify ya lo pone).
 * Sin registro de visitas.
 */
export function caddySite(domain: string, root: string): string {
  const headers = { ...SECURITY_HEADERS, 'Strict-Transport-Security': 'max-age=31536000' };
  const lines = Object.entries(headers).map(([k, v]) => `\t\t${k} "${v.replaceAll('"', '\\"')}"`);
  return `# Generado por scripts/caddy.ts desde apps/web/security-headers.ts: no editar a mano.
# En el servidor: copiarlo a /etc/caddy/ y añadir al Caddyfile una línea import con su ruta.
${domain} {
\troot * ${root}/actual
\tencode zstd gzip
\tfile_server

\theader {
${lines.join('\n')}
\t\t-Server
\t}
\theader /assets/* Cache-Control "${ASSETS_CACHE}"

\t# Configuración de Netlify, no hace falta servirla.
\trespond /_headers 404
}
`;
}
