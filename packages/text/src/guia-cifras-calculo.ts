import { readdirSync, readFileSync } from 'node:fs';
import { parseModel } from '@llave-inglesa/domain';
import { analyze } from '@llave-inglesa/engine';
import type { Metrica } from './guia.ts';

/** Los ejemplos (fixtures/ y fixtures/referencia/), por id (el nombre del fichero). */
function ejemplos() {
  const raiz = new URL('../../../fixtures/', import.meta.url);
  const ficheros = [
    ...readdirSync(raiz).filter((f) => f.endsWith('.json')).map((f) => new URL(f, raiz)),
    ...readdirSync(new URL('referencia/', raiz)).filter((f) => f.endsWith('.json')).map((f) => new URL(`referencia/${f}`, raiz)),
  ];
  return ficheros
    .sort((a, b) => a.pathname.localeCompare(b.pathname))
    .map((url) => {
      const id = url.pathname.split('/').pop()!.replace(/\.json$/, '');
      const r = parseModel(JSON.parse(readFileSync(url, 'utf8')));
      if (!r.ok) throw new Error(`El ejemplo ${id} no es válido`);
      return { id, model: r.model };
    });
}

/** Nombre visible de cada ejemplo. */
export function nombresDeEjemplos(): Record<string, string> {
  return Object.fromEntries(ejemplos().map((e) => [e.id, e.model.name]));
}

/** Puntuaciones de todos los ejemplos, calculadas por el motor. */
export function calcularCifras(): Record<string, Record<Metrica, number>> {
  const cifras: Record<string, Record<Metrica, number>> = {};
  for (const { id, model } of ejemplos()) {
    const a = analyze(model);
    cifras[id] = { security: a.security.score, resilience: a.resilience.score, usability: a.usability.score, inheritance: a.inheritance.score };
  }
  return cifras;
}
