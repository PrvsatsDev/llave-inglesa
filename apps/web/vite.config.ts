import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Política de seguridad del contenido para el build: la app no puede hacer
 * NINGUNA petición de red (connect-src 'none') ni cargar recursos externos.
 * Solo en build: el servidor de desarrollo necesita su websocket de recarga.
 */
const CSP = [
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

/**
 * Cabeceras HTTP de seguridad. El CSP es el mismo de la etiqueta <meta>, más lo que solo funciona
 * como cabecera: frame-ancestors (nadie puede meter la app en un iframe). Van a Netlify en el
 * fichero `_headers` y al `vite preview`, para que las pruebas e2e las usen también.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': `${CSP}; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
};

const block = (headers: Record<string, string>) => Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`).join('\n');
const NETLIFY_HEADERS = `/*
${block(SECURITY_HEADERS)}

/assets/*
${block({ 'Cache-Control': 'public, max-age=31536000, immutable' })}
`;

const contentSecurityPolicy = (): Plugin => ({
  name: 'llave-inglesa:csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: NETLIFY_HEADERS });
  },
});

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  // Las fuentes nunca se incrustan como data: (el CSP solo admite font-src 'self'), aunque sean pequeñas.
  build: { assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1', headers: SECURITY_HEADERS },
});
