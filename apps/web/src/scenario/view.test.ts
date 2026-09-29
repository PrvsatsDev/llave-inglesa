import { readFileSync } from 'node:fs';
import { parseModel, type CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { applyScenario, buildGraph, type LocationNode } from '../graph/build.ts';
import { scenarioView } from './view.ts';

function fixture(name: string): CustodyModel {
  const r = parseModel(JSON.parse(readFileSync(new URL(`../../../../fixtures/${name}.json`, import.meta.url), 'utf8')));
  if (!r.ok) throw new Error(name);
  return r.model;
}

const casa = fixture('todo-en-casa');

describe('scenarioView: ataques', () => {
  const wrench = scenarioView(casa, { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] })!;

  it('llave inglesa en casa: robo, con lo usado iluminado y el resto atenuado', () => {
    expect(wrench.outcome).toBe('stolen');
    expect(wrench.tone).toBe('attack');
    expect(wrench.items.get('ccq')).toBe('used');
    expect(wrench.items.get('metal-k2')).toBe('used');
    expect(wrench.items.get('metal-k1')).toBe('dim');
    expect(wrench.locations.get('casa')).toBe('reached');
    expect(wrench.locations.get('banco')).toBe('dim');
    expect(wrench.people.get('yo')).toBe('coerced');
    expect(wrench.people.get('pareja')).toBe('dim');
    expect(wrench.edges).toEqual(new Set(['access:yo:casa']));
    expect(wrench.explanation?.fact.kind).toBe('spend');
  });

  it('intrusión en casa: no roba; la Coldcard se alcanza pero no sirve (PIN)', () => {
    const v = scenarioView(casa, { kind: 'attack', atoms: [{ type: 'burglary', location: 'casa' }] })!;
    expect(v.outcome).toBe('safe');
    expect(v.items.get('ccq')).toBe('reached');
    expect(v.items.get('metal-k2')).toBe('used');
    expect(v.explanation).toBeNull();
  });
});

describe('scenarioView: privacidad', () => {
  it('la llave inglesa en casa roba y además expone el saldo (vía el descriptor)', () => {
    const v = scenarioView(casa, { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] })!;
    expect(v.exposure).toEqual({ exposed: true, via: 'secret:descriptor' });
  });

  it('una intrusión en el banco no roba, pero el descriptor filtra el saldo', () => {
    const v = scenarioView(casa, { kind: 'attack', atoms: [{ type: 'burglary', location: 'banco' }] })!;
    expect(v.outcome).toBe('safe');
    expect(v.exposure.exposed).toBe(true);
  });

  it('un RNG comprometido da dos semillas pero no la tercera xpub: ni roba ni ve', () => {
    const v = scenarioView(casa, { kind: 'attack', atoms: [{ type: 'entropy-compromise', origin: { kind: 'vendor', vendor: 'Coinkite' } }] })!;
    expect(v.outcome).toBe('safe');
    expect(v.exposure.exposed).toBe(false);
  });
});

describe('scenarioView: desgracias', () => {
  it('incapacidad del titular: bloqueo temporal', () => {
    const v = scenarioView(casa, { kind: 'loss', events: [{ type: 'incapacity', person: 'yo' }] })!;
    expect(v.outcome).toBe('lockout');
    expect(v.people.get('yo')).toBe('incapacitated');
    expect(v.people.get('pareja')).toBe('legit');
  });

  it('incendio en casa: recuperable, con lo de casa destruido', () => {
    const v = scenarioView(casa, { kind: 'loss', events: [{ type: 'destroy-location', location: 'casa' }] })!;
    expect(v.outcome).toBe('recoverable');
    expect(v.tone).toBe('recovery');
    expect(v.locations.get('casa')).toBe('destroyed');
    expect(v.items.get('ccq')).toBe('destroyed');
    expect(v.items.get('metal-k1')).toBe('used');
  });

  it('dos incendios: pérdida permanente', () => {
    const v = scenarioView(casa, {
      kind: 'loss',
      events: [{ type: 'destroy-location', location: 'casa' }, { type: 'destroy-location', location: 'banco' }],
    })!;
    expect(v.outcome).toBe('lost');
  });
});

describe('scenarioView: robustez', () => {
  it('un escenario que nombra algo que ya no existe no se evalúa', () => {
    expect(scenarioView(casa, { kind: 'attack', atoms: [{ type: 'burglary', location: 'no-existe' }] })).toBeNull();
  });
});

describe('applyScenario', () => {
  it('marca estados en los nodos y resalta solo las aristas implicadas', () => {
    const view = scenarioView(casa, { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] });
    const g = applyScenario(buildGraph(casa), view);
    const node = g.nodes.find((n): n is LocationNode => n.id === 'casa' && n.type === 'location')!;
    expect(node.data.state).toBe('reached');
    expect(node.data.items.find((i) => i.id === 'ccq')?.state).toBe('used');
    const hot = g.edges.filter((e) => e.className?.includes('edge-attack')).map((e) => e.id);
    expect(hot).toEqual(['access:yo:casa']);
    expect(g.edges.find((e) => e.id === 'access:yo:casa')?.animated).toBe(true);
  });

  it('sin escenario, el grafo queda intacto', () => {
    const g = buildGraph(casa);
    expect(applyScenario(g, null)).toBe(g);
  });
});
