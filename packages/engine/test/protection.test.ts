import { indexModel, type CustodyModelInput } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import {
  accessibleLocations,
  analyze,
  atomEffort,
  ATTACK_EFFORT,
  BURGLARY_EFFORT,
  COERCION_SURCHARGE,
  createWorld,
  itemsAvailableAt,
  lossAtoms,
  lossRarity,
  LOSS_RARITY,
  simulateAttack,
  simulateLosses,
  type AttackAtom,
} from '../src/index.ts';
import { base, parse } from './helpers.ts';

// Single-sig: la semilla de K1 en papel dentro de la caja fuerte de casa, y en acero en el banco.
const input = (overrides: Partial<CustodyModelInput> = {}): CustodyModelInput =>
  base({
    keys: [{ id: 'k1', label: 'K1' }],
    policy: { type: 'key', key: 'k1' },
    people: [
      { id: 'yo', name: 'Yo', role: 'owner' },
      { id: 'pareja', name: 'Pareja', role: 'heir' },
    ],
    artifacts: [
      { id: 'papel', label: 'Papel', medium: 'paper', contents: [{ type: 'seed', key: 'k1' }, { type: 'descriptor' }], location: 'caja' },
      { id: 'acero', label: 'Acero', medium: 'metal', contents: [{ type: 'seed', key: 'k1' }, { type: 'descriptor' }], location: 'banco' },
    ],
    locations: [
      { id: 'casa', name: 'Casa', access: [{ person: 'yo' }, { person: 'pareja' }] },
      { id: 'caja', name: 'Caja fuerte', protection: 'home-safe', inside: 'casa', access: [{ person: 'yo' }] },
      { id: 'banco', name: 'Caja del banco', protection: 'bank-box', access: [{ person: 'yo' }] },
    ],
    ...overrides,
  });
const model = parse(input());
const index = indexModel(model);
const effort = (atoms: AttackAtom[]) => atoms.reduce((sum, a) => sum + atomEffort(a, index), 0);
const burglary = (location: string): AttackAtom => ({ type: 'burglary', location });

describe('ubicaciones protegidas', () => {
  it('la intrusión cuesta según la protección: casa < caja fuerte < caja del banco', () => {
    expect(BURGLARY_EFFORT.none).toBeLessThan(BURGLARY_EFFORT['home-safe']);
    expect(BURGLARY_EFFORT['home-safe']).toBeLessThan(BURGLARY_EFFORT['bank-box']);
    expect(atomEffort(burglary('banco'), index)).toBe(BURGLARY_EFFORT['bank-box']);
  });

  it('la caja fuerte de casa exige entrar en casa: solo suma la diferencia', () => {
    expect(simulateAttack(model, [burglary('caja')]).canSpend).toBe(false);
    expect(simulateAttack(model, [burglary('casa'), burglary('caja')]).canSpend).toBe(true);
    expect(effort([burglary('casa'), burglary('caja')])).toBe(BURGLARY_EFFORT['home-safe']);
  });

  it('una caja fuerte suelta (sin contenedor) cuesta lo mismo que dentro de casa', () => {
    const loose = parse(input({ locations: input().locations!.map((l) => (l.id === 'caja' ? { ...l, inside: undefined } : l)) }));
    expect(atomEffort(burglary('caja'), indexModel(loose))).toBe(BURGLARY_EFFORT['home-safe']);
  });

  it('con la llave inglesa, la caja fuerte se abre en casa sin recargo; la del banco, con recargo', () => {
    const atCaja: AttackAtom = { type: 'coercion', person: 'yo', location: 'caja' };
    expect(simulateAttack(model, [atCaja]).canSpend).toBe(true);
    expect(atomEffort(atCaja, index)).toBe(ATTACK_EFFORT.coercion);
    expect(atomEffort({ type: 'coercion', person: 'yo', location: 'banco' }, index)).toBe(ATTACK_EFFORT.coercion + COERCION_SURCHARGE['bank-box']);
  });

  it('el robo más barato es la llave inglesa en casa; entrar a la fuerza cuesta 2.5', () => {
    const s = analyze(model).security;
    expect(s.minEffort).toBe(ATTACK_EFFORT.coercion);
    const i = s.cuts.findIndex((c) => c.length === 2 && c.every((a) => a.type === 'burglary'));
    expect(s.efforts[i]).toBe(BURGLARY_EFFORT['home-safe']);
  });

  it('para usar la caja fuerte hay que poder entrar también en casa', () => {
    const noHouse = parse(input({ locations: input().locations!.map((l) => (l.id === 'casa' ? { ...l, access: [{ person: 'pareja' }] } : l)) }));
    expect(accessibleLocations(createWorld(noHouse), 'yo')).toEqual(['banco']);
  });

  it('casa y su caja fuerte son una sola visita', () => {
    const signer = { id: 'ss', label: 'SeedSigner', vendor: 'SeedSigner', kind: 'stateless' as const, location: 'casa' };
    const a = analyze(parse(input({ devices: [signer], artifacts: input().artifacts!.filter((x) => x.id === 'papel') })));
    expect(a.usability.locations?.sort()).toEqual(['caja', 'casa']);
    expect(a.usability.visits).toBe(1);
  });
});

describe('desastres en ubicaciones protegidas', () => {
  const fire = { type: 'destroy-location', location: 'casa', disaster: 'fire' } as const;

  it('el incendio de casa alcanza la caja fuerte: el papel no sobrevive', () => {
    expect(itemsAvailableAt(createWorld(model, [fire]), 'caja')).toEqual([]);
    expect(simulateLosses(model, [fire, { type: 'destroy-location', location: 'banco', disaster: 'total' }]).canSpend).toBe(false);
  });

  it('perder la casa es perder también la caja fuerte', () => {
    const world = createWorld(model, [{ type: 'destroy-location', location: 'casa', disaster: 'total' }]);
    expect(itemsAvailableAt(world, 'caja')).toEqual([]);
  });

  it('la caja fuerte no tiene incendio ni inundación propios, solo la pérdida del acceso', () => {
    const disasters = lossAtoms(createWorld(model)).flatMap((e) => (e.type === 'destroy-location' && e.location === 'caja' ? [e.disaster] : []));
    expect(disasters).toEqual(['total']);
  });

  it('un incendio o una inundación en la caja del banco son más raros que en casa', () => {
    for (const disaster of ['fire', 'flood'] as const) {
      expect(lossRarity({ type: 'destroy-location', location: 'banco', disaster }, index)).toBe(LOSS_RARITY['vault-disaster']);
      expect(lossRarity({ type: 'destroy-location', location: 'casa', disaster }, index)).toBeLessThan(LOSS_RARITY['vault-disaster']);
    }
  });
});
