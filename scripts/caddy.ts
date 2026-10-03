/**
 * Genera el bloque de sitio de Caddy (deploy/sitio.caddy) para el servidor de deploy/servidor.env,
 * con las cabeceras de seguridad de la app. Ni el .env ni el resultado se suben al repo.
 * Uso: npx tsx scripts/caddy.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { caddySite } from '../apps/web/security-headers.ts';

const envFile = new URL('../deploy/servidor.env', import.meta.url);
let text: string;
try {
  text = readFileSync(envFile, 'utf8');
} catch {
  console.error('Falta deploy/servidor.env: copia deploy/servidor.env.ejemplo y rellénalo.');
  process.exit(1);
}
const env = Object.fromEntries(
  text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [k, ...v] = l.split('=');
      return [k!.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')];
    }),
);
if (!env.DOMINIO || !env.RAIZ) {
  console.error('deploy/servidor.env necesita DOMINIO y RAIZ.');
  process.exit(1);
}
writeFileSync(new URL('../deploy/sitio.caddy', import.meta.url), caddySite(env.DOMINIO, env.RAIZ));
console.log(`deploy/sitio.caddy (para ${env.DOMINIO})`);
