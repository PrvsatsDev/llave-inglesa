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

const contentSecurityPolicy = (): Plugin => ({
  name: 'llave-inglesa:csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
});

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  // Las fuentes nunca se incrustan como data: (el CSP solo admite font-src 'self'), aunque sean pequeñas.
  build: { assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
