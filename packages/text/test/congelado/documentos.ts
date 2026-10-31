import { readdirSync, readFileSync } from 'node:fs';

export const CARPETA = new URL('./', import.meta.url);

/** Los ejemplos de `fixtures/` y `fixtures/referencia/`, por ruta relativa, tal como están en disco. */
export function ejemplos(): [string, unknown][] {
  const raiz = new URL('../../../../fixtures/', import.meta.url);
  const rutas = [
    ...readdirSync(raiz).filter((f) => f.endsWith('.json')),
    ...readdirSync(new URL('referencia/', raiz)).filter((f) => f.endsWith('.json')).map((f) => `referencia/${f}`),
  ].sort();
  return rutas.map((r) => [r, JSON.parse(readFileSync(new URL(r, raiz), 'utf8'))]);
}

/** Los modelos aleatorios guardados en la fase 0 (no dependen de que el generador cambie después). */
export function aleatorios(): unknown[] {
  return JSON.parse(readFileSync(new URL('aleatorios.json', CARPETA), 'utf8'));
}
