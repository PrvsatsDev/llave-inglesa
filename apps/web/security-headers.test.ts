import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { caddyContainer, caddySite, CSP, SECURITY_HEADERS } from './security-headers.ts';

describe('cabeceras de seguridad', () => {
  it('el CSP prohíbe cualquier petición de red y los iframes ajenos', () => {
    expect(CSP).toContain("connect-src 'none'");
    expect(SECURITY_HEADERS['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  it('el bloque de Caddy lleva todas las cabeceras', () => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(caddySite('ejemplo.net', '/srv/x')).toContain(`${name} "${value}"`);
    }
  });

  it('el bloque de Caddy sirve la versión enlazada en `actual` del dominio indicado', () => {
    const site = caddySite('web.ejemplo.net', '/srv/web');
    expect(site).toMatch(/^web\.ejemplo\.net \{$/m);
    expect(site).toContain('root * /srv/web/actual');
    expect(site).toContain('Strict-Transport-Security');
  });

  it('la imagen para Umbrel lleva las mismas cabeceras, sin HSTS ni administración, y su Caddyfile está al día', () => {
    const file = caddyContainer();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(file).toContain(`${name} "${value}"`);
    expect(file).not.toContain('Strict-Transport-Security');
    expect(file).toContain('admin off');
    expect(file).not.toMatch(/\blog\b/);
    expect(readFileSync(new URL('../../umbrel/Caddyfile', import.meta.url), 'utf8')).toBe(file);
  });
});
