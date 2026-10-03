import { readFileSync } from 'node:fs';
import { addLocation, parseModel, setLocationInside, type CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { buildGraph, type LocationNode, type PersonNode } from './build.ts';
import { layoutGraph, locationHeight } from './layout.ts';

function fixture(name: string): CustodyModel {
  const result = parseModel(JSON.parse(readFileSync(new URL(`../../../../fixtures/${name}.json`, import.meta.url), 'utf8')));
  if (!result.ok) throw new Error(name);
  return result.model;
}

describe('buildGraph', () => {
  const graph = buildGraph(fixture('todo-en-casa'));
  const location = (id: string) => graph.nodes.find((n): n is LocationNode => n.id === id && n.type === 'location')!;
  const person = (id: string) => graph.nodes.find((n): n is PersonNode => n.id === id && n.type === 'person')!;

  it('una ubicación por nodo, con sus objetos dentro', () => {
    expect(location('casa').data.items.map((i) => i.id)).toEqual(['ccq', 'seedsigner', 'metal-k2', 'desc-casa']);
  });

  it('marca las keys materializadas en cada ubicación (dispositivos + semillas, no descriptor)', () => {
    expect(location('casa').data.keys.map((k) => k.id)).toEqual(['k1', 'k2']);
    expect(location('banco').data.keys.map((k) => k.id)).toEqual(['k1']);
  });

  it('las personas llevan lo que saben de memoria', () => {
    expect(person('yo').data.knows).toEqual([{ kind: 'pin', device: 'ccq', label: 'Coldcard Q' }]);
  });

  it('accesos condicionales como aristas discontinuas con etiqueta', () => {
    const edge = graph.edges.find((e) => e.id === 'access:pareja:banco')!;
    expect(edge.data?.conditional).toBe(true);
    expect(edge.label).toBe('tras fallecer Yo');
    expect(graph.edges.find((e) => e.id === 'access:yo:casa')!.data?.conditional).toBe(false);
  });
});

describe('ubicaciones anidadas', () => {
  const casa = fixture('todo-en-casa');
  const { model: withSafe, id: safe } = addLocation(casa, 'Caja fuerte');
  const graph = buildGraph(setLocationInside(withSafe, safe, 'casa'));
  const x = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;

  it('una flecha va de lo contenido al continente', () => {
    const edge = graph.edges.find((e) => e.id === `contains:casa:${safe}`)!;
    expect(edge).toMatchObject({ source: safe, target: 'casa', sourceHandle: 'left', targetHandle: 'right', markerEnd: { type: 'arrowclosed' } });
    expect(edge.data?.contains).toBe(true);
  });

  it('la de dentro va justo a la derecha de la que la contiene, aunque se creara la última', () => {
    expect(x('casa')).toBeLessThan(x(safe));
    expect(x(safe)).toBeLessThan(x('banco'));
  });

  it('sin anidar no hay aristas de contención', () => {
    expect(buildGraph(casa).edges.some((e) => e.data?.contains)).toBe(false);
  });
});

describe('layoutGraph', () => {
  it('personas debajo de la ubicación más alta, ordenadas por baricentro', () => {
    const positions = layoutGraph(
      [{ id: 'a', rows: 1 }, { id: 'b', rows: 4 }, { id: 'c', rows: 2 }],
      [
        { id: 'derecha', rows: 0, links: ['c'] },
        { id: 'izquierda', rows: 0, links: ['a'] },
        { id: 'suelta', rows: 0, links: [] },
      ],
    );
    const x = (id: string) => positions.get(id)!.x;
    expect(x('izquierda')).toBeLessThan(x('derecha'));
    expect(x('derecha')).toBeLessThan(x('suelta'));
    expect(positions.get('izquierda')!.y).toBeGreaterThan(locationHeight(4));
  });
});
