import { describe, expect, it } from 'vitest';
import { createWorld, derive, explain, minimalCuts, securityScore, type Holdings, type SigningMode } from '../src/index.ts';
import { base, parse } from './helpers.ts';

const everything: Holdings = { people: ['yo'], locations: ['casa'] };
const run = (input: unknown, mode: SigningMode = 'any', holdings = everything) =>
  derive(createWorld(parse(input)), holdings, mode);

const seedPlate = (key: string) => ({
  id: `metal-${key}`, label: `Metal ${key}`, medium: 'metal' as const, contents: [{ type: 'seed' as const, key }], location: 'casa',
});

describe('reglas del motor', () => {
  it('multisig: con todas las semillas basta (las xpubs se derivan)', () => {
    expect(run(base({ artifacts: [seedPlate('k1'), seedPlate('k2')] })).canSpend).toBe(true);
  });

  it('multisig: sin la xpub de la tercera key no se puede construir la transacción', () => {
    const model = base({
      keys: [{ id: 'k1', label: 'K1' }, { id: 'k2', label: 'K2' }, { id: 'k3', label: 'K3' }],
      policy: { type: 'thresh', k: 2, of: ['k1', 'k2', 'k3'].map((key) => ({ type: 'key' as const, key })) },
      artifacts: [seedPlate('k1'), seedPlate('k2')],
    });
    const d = run(model);
    expect(d.signable.size).toBe(2);
    expect(d.canSpend).toBe(false);

    const withDescriptor = { ...model, artifacts: [...model.artifacts!, { id: 'desc', label: 'Descriptor', medium: 'paper', contents: [{ type: 'descriptor' }], location: 'casa' }] };
    expect(run(withDescriptor).canSpend).toBe(true);
  });

  it('un dispositivo con PIN no firma sin el PIN', () => {
    const model = base({
      policy: { type: 'key', key: 'k1' },
      keys: [{ id: 'k1', label: 'K1' }],
      devices: [{ id: 'cc', label: 'Coldcard', vendor: 'Coinkite', kind: 'stateful', holds: ['k1'], pinProtected: true, location: 'casa' }],
    });
    expect(run(model).canSpend).toBe(false);
    const withPin = { ...model, people: [{ id: 'yo', name: 'Yo', role: 'owner', knows: [{ type: 'pin', device: 'cc' }] }] };
    expect(run(withPin).canSpend).toBe(true);
  });

  it('la passphrase es imprescindible', () => {
    const model = base({
      policy: { type: 'key', key: 'k1' },
      keys: [{ id: 'k1', label: 'K1', passphrase: true }],
      artifacts: [seedPlate('k1')],
    });
    expect(run(model).canSpend).toBe(false);
  });

  it('modo seguro: la semilla sola no firma sin un dispositivo que la acepte', () => {
    const model = base({ artifacts: [seedPlate('k1'), seedPlate('k2')] });
    expect(run(model, 'secure').canSpend).toBe(false);
    const withSigner = { ...model, devices: [{ id: 'ss', label: 'SeedSigner', vendor: 'SeedSigner', kind: 'stateless', location: 'casa' }] };
    expect(run(withSigner, 'secure').canSpend).toBe(true);
  });

  it('un artefacto cifrado solo se lee con su clave', () => {
    const model = base({
      policy: { type: 'key', key: 'k1' },
      keys: [{ id: 'k1', label: 'K1' }, { id: 'k2', label: 'K2' }],
      artifacts: [{ ...seedPlate('k1'), lockedBy: [{ type: 'seed', key: 'k2' }] }],
    });
    expect(run(model).canSpend).toBe(false);
  });

  it('descriptor cifrado en la nube: el hackeo solo no basta, hace falta la contraseña', () => {
    const model = parse(
      base({
        keys: [{ id: 'k1', label: 'K1' }, { id: 'k2', label: 'K2' }, { id: 'k3', label: 'K3' }],
        policy: { type: 'thresh', k: 2, of: ['k1', 'k2', 'k3'].map((key) => ({ type: 'key' as const, key })) },
        artifacts: [
          seedPlate('k1'),
          seedPlate('k2'),
          { id: 'desc', label: 'Descriptor', medium: 'digital', contents: [{ type: 'descriptor' }], lockedBy: [{ type: 'password', artifact: 'desc' }], location: 'nube' },
        ],
        people: [{ id: 'yo', name: 'Yo', role: 'owner', knows: [{ type: 'password', artifact: 'desc' }] }],
        locations: [
          { id: 'casa', name: 'Casa', access: [{ person: 'yo' }] },
          { id: 'nube', name: 'Nube', kind: 'cloud', access: [{ person: 'yo' }] },
        ],
      }),
    );
    const world = createWorld(model);
    const thief = derive(world, { people: [], locations: ['casa', 'nube'] }, 'any');
    expect(thief.has({ kind: 'secret', secret: { type: 'descriptor' } })).toBe(false);
    expect(thief.canSpend).toBe(false);
    expect(derive(world, { people: ['yo'], locations: ['casa', 'nube'] }, 'any').canSpend).toBe(true);
  });

  it('explica la cadena completa hasta los hechos base', () => {
    const d = run(base({ artifacts: [seedPlate('k1'), seedPlate('k2')] }));
    const tree = explain(d, 'spend');
    const leaves: string[] = [];
    const walk = (n: NonNullable<typeof tree>) => (n.children.length ? n.children.forEach(walk) : leaves.push(n.justification.rule));
    walk(tree!);
    expect(new Set(leaves)).toEqual(new Set(['location-access']));
  });
});

describe('puntuación de seguridad', () => {
  it('más esfuerzo nunca puntúa peor, y más vías baratas nunca puntúan mejor', () => {
    for (let e = 0; e < 7; e += 0.5) {
      expect(securityScore(e + 0.5, 1)).toBeGreaterThanOrEqual(securityScore(e, 1));
      expect(securityScore(e, 3)).toBeLessThanOrEqual(securityScore(e, 1));
    }
    expect(securityScore(null, 0)).toBe(100);
  });
});

describe('cortes mínimos', () => {
  it('encuentra solo conjuntos mínimos', () => {
    // Se "rompe" si están a la vez 1 y 2, o si está 3.
    const cuts = minimalCuts([1, 2, 3, 4], (s) => (s.includes(1) && s.includes(2)) || s.includes(3), 3);
    expect(cuts).toEqual([[3], [1, 2]]);
  });
});

describe('firmar cargando la semilla', () => {
  // 2 de 2: un Coldcard con K2 que solo carga K2, y una SeedSigner que carga K1 en otro sitio.
  const model = base({
    locations: [
      { id: 'casa', name: 'Casa', access: [{ person: 'yo' }] },
      { id: 'otra', name: 'Otra', access: [{ person: 'yo' }] },
    ],
    devices: [
      { id: 'cc', label: 'Coldcard', vendor: 'Coinkite', kind: 'stateful', holds: ['k2'], pinProtected: false, acceptsExternalSeed: true, loads: ['k2'], location: 'casa' },
      { id: 'ss', label: 'SeedSigner', vendor: 'SeedSigner', kind: 'stateless', pinProtected: false, loads: ['k1'], location: 'otra' },
    ],
    artifacts: [seedPlate('k1')],
  });

  it('un dispositivo solo carga las keys que se le indican', () => {
    expect(run(model, 'secure', { people: ['yo'], locations: ['casa'] }).canSpend).toBe(false);
  });

  it('K1 se firma en la SeedSigner, no en el Coldcard', () => {
    const d = run(model, 'secure', { people: ['yo'], locations: ['casa', 'otra'] });
    expect(d.canSpend).toBe(true);
    expect(d.facts.get('sign:k1' as never)?.justification.via).toEqual({ device: 'ss' });
  });

  it('sin indicar qué carga, un dispositivo sin estado acepta cualquier semilla', () => {
    const loose = { ...model, devices: model.devices!.map((d) => (d.id === 'ss' ? { ...d, loads: undefined, location: 'casa' } : d)) };
    expect(run(loose, 'secure', { people: ['yo'], locations: ['casa'] }).canSpend).toBe(true);
  });
});
