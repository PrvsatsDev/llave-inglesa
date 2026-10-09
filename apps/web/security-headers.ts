/**
 * Cabeceras de seguridad: una sola lista para todos los sitios donde se sirve la app.
 *   - <meta> del HTML (vite.config.ts): el CSP, que también protege el zip usado sin conexión.
 *   - `vite preview`, para que las pruebas e2e las usen también.
 *   - El bloque de Caddy para un servidor propio (lo genera scripts/caddy.ts, ver deploy/README.md).
 *   - El Caddyfile de la imagen Docker para Umbrel (umbrel/Caddyfile, ver umbrel/README.md).
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

/**
 * Bloque de sitio para Caddy. Sirve la versión enlazada en `<root>/actual` tal cual (sin inyectar
 * nada: la web publicada es idéntica al build), con HTTPS automático y HSTS.
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
}
`;
}

/** Puerto en el que escucha la imagen Docker (sin privilegios: por encima de 1024). */
export const CONTAINER_PORT = 8080;

/**
 * Caddyfile de la imagen Docker (Umbrel): sirve el build tal cual en el puerto del contenedor, con las mismas
 * cabeceras. Sin HTTPS propio ni HSTS (de eso se encarga Umbrel delante), sin API de administración, sin guardar
 * configuración y sin registro de visitas.
 */
export function caddyContainer(): string {
  const lines = Object.entries(SECURITY_HEADERS).map(([k, v]) => `\t\t${k} "${v.replaceAll('"', '\\"')}"`);
  return `# Generado por scripts/imagen.sh desde apps/web/security-headers.ts: no editar a mano.
{
\tadmin off
\tauto_https off
\tpersist_config off
}

:${CONTAINER_PORT} {
\troot * /srv
\tencode zstd gzip
\tfile_server

\theader {
${lines.join('\n')}
\t\t-Server
\t}
\theader /assets/* Cache-Control "${ASSETS_CACHE}"
}
`;
}
