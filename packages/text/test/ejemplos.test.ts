import { readdirSync, readFileSync } from 'node:fs';
import { checkIntegrity, parseModel, type CustodyModel } from '@llave-inglesa/domain';
import { analyze } from '@llave-inglesa/engine';
import { describe, expect, it } from 'vitest';
import { traducirEjemplo } from '../src/ejemplos.ts';
import { EJEMPLOS as en } from '../src/en/ejemplos.ts';

const raiz = new URL('../../../fixtures/', import.meta.url);
const ficheros = [
  ...readdirSync(raiz).filter((f) => f.endsWith('.json')),
  ...readdirSync(new URL('referencia/', raiz)).map((f) => `referencia/${f}`),
];
const ejemplos = ficheros.map((f) => {
  const r = parseModel(JSON.parse(readFileSync(new URL(f, raiz), 'utf8')));
  if (!r.ok) throw new Error(f);
  return { f, model: r.model as CustodyModel };
});

/** Lo que ya vale en inglés tal cual: nombres propios y términos técnicos. */
const IGUALES = new Set(['iCloud', 'Descriptor']);

const textos = (m: CustodyModel) => [
  m.name,
  ...(m.description ? [m.description] : []),
  ...m.people.map((p) => p.name),
  ...m.locations.map((l) => l.name),
  ...m.artifacts.map((a) => a.label),
];

describe('ejemplos en inglés', () => {
  it('todos sus textos tienen traducción', () => {
    const faltan = [...new Set(ejemplos.flatMap(({ model }) => textos(model)))].filter((t) => !(t in en) && !IGUALES.has(t));
    expect(faltan).toEqual([]);
  });

  it('el diccionario no guarda textos que ya no usa ningún ejemplo', () => {
    const usados = new Set(ejemplos.flatMap(({ model }) => textos(model)));
    expect(Object.keys(en).filter((t) => !usados.has(t))).toEqual([]);
  });

  it.each(ejemplos)('$f: traducido sigue siendo válido y se analiza igual', ({ model }) => {
    const traducido = traducirEjemplo(model, en);
    expect(parseModel(traducido).ok).toBe(true);
    expect(checkIntegrity(traducido).map((i) => i.code)).toEqual(checkIntegrity(model).map((i) => i.code));
    const [a, b] = [analyze(model), analyze(traducido)];
    expect([b.security.score, b.resilience.score, b.usability.score, b.inheritance.score]).toEqual([
      a.security.score,
      a.resilience.score,
      a.usability.score,
      a.inheritance.score,
    ]);
  });
});
