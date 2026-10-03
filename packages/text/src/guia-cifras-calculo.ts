import { readdirSync, readFileSync } from 'node:fs';
import { parseModel } from '@llave-inglesa/domain';
import { analyze } from '@llave-inglesa/engine';
import type { Metrica } from './guia.ts';

/** Puntuaciones de todos los ejemplos (fixtures/ y fixtures/referencia/), calculadas por el motor. */
export function calcularCifras(): Record<string, Record<Metrica, number>> {
  const raiz = new URL('../../../fixtures/', import.meta.url);
  const ficheros = [
    ...readdirSync(raiz).filter((f) => f.endsWith('.json')).map((f) => new URL(f, raiz)),
    ...readdirSync(new URL('referencia/', raiz)).filter((f) => f.endsWith('.json')).map((f) => new URL(`referencia/${f}`, raiz)),
  ];
  const cifras: Record<string, Record<Metrica, number>> = {};
  for (const url of ficheros.sort((a, b) => a.pathname.localeCompare(b.pathname))) {
    const id = url.pathname.split('/').pop()!.replace(/\.json$/, '');
    const r = parseModel(JSON.parse(readFileSync(url, 'utf8')));
    if (!r.ok) throw new Error(`El ejemplo ${id} no es válido`);
    const a = analyze(r.model);
    cifras[id] = { security: a.security.score, resilience: a.resilience.score, usability: a.usability.score, inheritance: a.inheritance.score };
  }
  return cifras;
}
