import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { CSP, netlifyHeaders, SECURITY_HEADERS } from './security-headers.ts';

/** Versión publicada (la de package.json), visible en la app para compararla con la Release. */
const VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;

const contentSecurityPolicy = (): Plugin => ({
  name: 'llave-inglesa:csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: netlifyHeaders() });
  },
});

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  // Las fuentes nunca se incrustan como data: (el CSP solo admite font-src 'self'), aunque sean pequeñas.
  build: { assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1', headers: SECURITY_HEADERS },
});
