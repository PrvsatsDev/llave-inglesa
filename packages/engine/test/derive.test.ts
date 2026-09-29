import { describe, expect, it } from 'vitest';
import { createWorld, derive, explain, minimalCuts, type Holdings, type SigningMode } from '../src/index.ts';
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

  it('explica la cadena completa hasta los hechos base', () => {
    const d = run(base({ artifacts: [seedPlate('k1'), seedPlate('k2')] }));
    const tree = explain(d, 'spend');
    const leaves: string[] = [];
    const walk = (n: NonNullable<typeof tree>) => (n.children.length ? n.children.forEach(walk) : leaves.push(n.justification.rule));
    walk(tree!);
    expect(new Set(leaves)).toEqual(new Set(['location-access']));
  });
});

describe('cortes mínimos', () => {
  it('encuentra solo conjuntos mínimos', () => {
    // Se "rompe" si están a la vez 1 y 2, o si está 3.
    const cuts = minimalCuts([1, 2, 3, 4], (s) => (s.includes(1) && s.includes(2)) || s.includes(3), 3);
    expect(cuts).toEqual([[3], [1, 2]]);
  });
});
