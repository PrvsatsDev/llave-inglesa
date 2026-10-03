import { readFileSync } from 'node:fs';
import { parseModel, updateDevice, type CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { applyScenario, buildGraph, type LocationNode } from '../graph/build.ts';
import { scenarioView, type Scenario } from './view.ts';

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
    expect(wrench.locations.get('casa')).toBe('used');
    expect(wrench.locations.get('banco')).toBe('dim');
    expect(wrench.people.get('yo')).toBe('coerced');
    expect(wrench.people.get('pareja')).toBe('dim');
    expect(wrench.edges).toEqual(new Set(['access:yo:casa']));
    expect(wrench.reachedEdges).toEqual(new Set());
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

describe('scenarioView: PIN de coacción que no hace falta vencer', () => {
  it('si la llave inglesa también da la placa, el mapa usa la placa y no el dispositivo', () => {
    const r06 = updateDevice(fixture('referencia/r06-passphrase-solo-memoria'), 'nuevo-dispositivo', { duressPin: true });
    const v = scenarioView(r06, { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] })!;
    expect(v.outcome).toBe('stolen');
    expect(v.duress).toEqual([]);
    expect(v.items.get('nuevo-backup')).toBe('used');
    expect(v.items.get('nuevo-dispositivo')).not.toBe('used');
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
    const v = scenarioView(casa, { kind: 'loss', events: [{ type: 'destroy-location', location: 'casa', disaster: 'total' }] })!;
    expect(v.outcome).toBe('recoverable');
    expect(v.tone).toBe('recovery');
    expect(v.locations.get('casa')).toBe('destroyed');
    expect(v.items.get('ccq')).toBe('destroyed');
    expect(v.items.get('metal-k1')).toBe('used');
  });

  it('fallecimiento del titular: distingue las ubicaciones necesarias de las solo alcanzables', () => {
    const v = scenarioView(casa, { kind: 'loss', events: [{ type: 'death', person: 'yo' }] })!;
    expect(v.outcome).toBe('recoverable');
    expect(v.locations.get('casa')).toBe('used');
    expect(v.locations.get('banco')).toBe('used');
    expect(v.locations.get('padres')).toBe('reached');
    expect(v.edges).toEqual(new Set(['access:pareja:casa', 'access:pareja:banco']));
    expect(v.reachedEdges).toEqual(new Set(['access:pareja:padres']));
  });

  it('una ubicación anidada que se usa hace necesaria la que la contiene', () => {
    const m = fixture('referencia/r05-passphrase-copia-aparte');
    const v = scenarioView(m, { kind: 'loss', events: [{ type: 'death', person: 'yo' }] })!;
    expect(v.items.get('nuevo-dispositivo')).toBe('reached');
    expect(v.locations.get('nueva-ubicacion')).toBe('used');
    expect(v.locations.get('casa')).toBe('used');
  });

  it('dos incendios: pérdida permanente', () => {
    const v = scenarioView(casa, {
      kind: 'loss',
      events: [{ type: 'destroy-location', location: 'casa', disaster: 'total' }, { type: 'destroy-location', location: 'banco', disaster: 'total' }],
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
    expect(node.data.state).toBe('used');
    expect(node.data.items.find((i) => i.id === 'ccq')?.state).toBe('used');
    const hot = g.edges.filter((e) => e.className?.includes('edge-attack')).map((e) => e.id);
    expect(hot).toEqual(['access:yo:casa']);
    expect(g.edges.find((e) => e.id === 'access:yo:casa')?.animated).toBe(true);
  });

  it('las aristas a ubicaciones solo alcanzables quedan en tono suave, sin animar', () => {
    const view = scenarioView(casa, { kind: 'loss', events: [{ type: 'death', person: 'yo' }] });
    const g = applyScenario(buildGraph(casa), view);
    const edge = g.edges.find((e) => e.id === 'access:pareja:padres')!;
    expect(edge.className).toContain('edge-reached-recovery');
    expect(edge.animated).toBe(false);
  });

  it('en una desgracia, lo que usa la recuperación ofrece probar su pérdida; en un ataque, no', () => {
    const items = (scenario: Scenario) =>
      applyScenario(buildGraph(casa), scenarioView(casa, scenario)).nodes.flatMap((n) => (n.type === 'location' ? n.data.items : []));
    const fire = items({ kind: 'loss', events: [{ type: 'destroy-location', location: 'casa', disaster: 'fire' }] });
    expect(fire.find((i) => i.id === 'metal-k2')).toMatchObject({ survived: true, canLose: true });
    expect(fire.find((i) => i.id === 'ccq')?.canLose).toBe(false);
    const wrench = items({ kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] });
    expect(wrench.some((i) => i.canLose)).toBe(false);
  });

  it('sin escenario, el grafo queda intacto', () => {
    const g = buildGraph(casa);
    expect(applyScenario(g, null)).toBe(g);
  });
});

describe('scenarioView: PIN de coacción y dispositivos comprometidos', () => {
  const wrench: Scenario = { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] };

  it('la llave inglesa con PIN de coacción en la Coldcard Q tiene que vencerlo', () => {
    expect(scenarioView(casa, wrench)!.duress).toEqual([]);
    const duress = updateDevice(casa, 'ccq', { duressPin: true });
    expect(scenarioView(duress, wrench)!.duress).toEqual([{ person: 'yo', device: 'ccq' }]);
  });

  it('el firmware malicioso señala en el mapa el dispositivo comprometido', () => {
    const view = scenarioView(casa, { kind: 'attack', atoms: [{ type: 'malicious-firmware', vendor: 'Coinkite' }] })!;
    expect(view.compromised).toEqual(new Map([['ccq', 'firmware']]));
    const graph = applyScenario(buildGraph(casa), view);
    const item = graph.nodes.flatMap((n) => (n.type === 'location' ? (n as LocationNode).data.items : [])).find((i) => i.id === 'ccq');
    expect(item?.compromise).toBe('firmware');
  });
});

describe('scenarioView: incendio', () => {
  it('la ubicación lleva su desastre; el acero resiste y lo demás se destruye', () => {
    const v = scenarioView(casa, { kind: 'loss', events: [{ type: 'destroy-location', location: 'casa', disaster: 'fire' }] })!;
    expect(v.outcome).toBe('recoverable');
    expect(v.disasters).toEqual(new Map([['casa', 'fire']]));
    expect(v.survived).toEqual(new Set(['metal-k2']));
    expect(v.items.get('ccq')).toBe('destroyed');
    expect(v.items.get('metal-k2')).not.toBe('destroyed');
  });
});
