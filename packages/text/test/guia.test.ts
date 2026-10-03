import { readFileSync } from 'node:fs';
import { parseModel, type CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { calcularCifras, nombresDeEjemplos } from '../src/guia-cifras-calculo.ts';
import { guiaMarkdown } from '../src/guia-markdown.ts';
import { CIFRAS, GUIA, type Bloque, type Escenario } from '../src/index.ts';

const bloques = GUIA.flatMap((c) => c.bloques);
const trozos = bloques.flatMap((b: Bloque) => (b.tipo === 'lista' ? b.items.flat() : 'texto' in b && Array.isArray(b.texto) ? b.texto : []));

function ejemplo(id: string): CustodyModel {
  const ruta = id.startsWith('r') && /^r\d\d-/.test(id) ? `referencia/${id}` : id;
  const r = parseModel(JSON.parse(readFileSync(new URL(`../../../fixtures/${ruta}.json`, import.meta.url), 'utf8')));
  if (!r.ok) throw new Error(id);
  return r.model;
}

/** Ids que nombra un escenario: personas, ubicaciones, objetos y keys. */
function ids(e: Escenario): string[] {
  if (e.kind === 'attack')
    return e.atoms.flatMap((a) =>
      a.type === 'burglary' ? [a.location] : a.type === 'coercion' ? [a.person, ...(a.location ? [a.location] : [])] : a.type === 'insider' ? [a.person] : a.type === 'passphrase-bruteforce' ? [a.key] : [],
    );
  return e.events.map((ev) => (ev.type === 'destroy-location' ? ev.location : ev.type === 'item-loss' ? ev.item : ev.person));
}

describe('guía de uso', () => {
  it('las cifras están al día con el motor (si falla: npx tsx scripts/guia.ts)', () => {
    expect(CIFRAS).toEqual(calcularCifras());
  });

  it('docs/GUIA.md está al día (si falla: npx tsx scripts/guia.ts)', () => {
    const fichero = readFileSync(new URL('../../../docs/GUIA.md', import.meta.url), 'utf8');
    expect(fichero).toBe(guiaMarkdown(nombresDeEjemplos()));
  });

  it('cada capítulo tiene un id único', () => {
    expect(new Set(GUIA.map((c) => c.id)).size).toBe(GUIA.length);
  });

  it('cada cifra citada y cada ejemplo existen', () => {
    for (const t of trozos) if (typeof t === 'object' && 'cifra' in t) expect(CIFRAS[t.cifra.ejemplo], t.cifra.ejemplo).toBeDefined();
    for (const b of bloques) if (b.tipo === 'ejemplo' || b.tipo === 'simular') expect(CIFRAS[b.ejemplo], b.ejemplo).toBeDefined();
  });

  it('cada enlace a otro capítulo apunta a uno que existe, y los externos son https', () => {
    const capitulos = new Set(GUIA.map((c) => c.id));
    for (const t of trozos) {
      if (typeof t === 'object' && 'capitulo' in t) expect(capitulos.has(t.capitulo), t.capitulo).toBe(true);
      if (typeof t === 'object' && 'enlace' in t) expect(t.enlace).toMatch(/^https:\/\//);
    }
  });

  it('cada simulación nombra cosas que existen en su ejemplo', () => {
    for (const b of bloques) {
      if (b.tipo !== 'simular') continue;
      const m = ejemplo(b.ejemplo);
      const existentes = new Set([...m.people, ...m.locations, ...m.devices, ...m.artifacts, ...m.keys].map((e) => e.id));
      for (const id of ids(b.escenario)) expect(existentes.has(id), `${b.texto}: ${id}`).toBe(true);
    }
  });
});
