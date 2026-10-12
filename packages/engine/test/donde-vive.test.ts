import { indexModel, setPersonHome, type CustodyModelInput } from '@llave-inglesa/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyze, simulateAttack, type AttackAtom } from '../src/index.ts';
import {
  ATTACK_EFFORT,
  COERCION_AWAY_SURCHARGE,
  COERCION_SURCHARGE,
  EXTRA_SITE_SURCHARGE,
  atomEfforts,
  attackEffort,
  coercionSurchargeReason,
  coercionAssaults,
} from '../src/score.ts';
import { base, loadFixture, parse } from './helpers.ts';

const coercion = (person: string, location: string | null) => ({ type: 'coercion' as const, person, location });

/** Single-sig con passphrase aleatoria (no se adivina): hace falta la semilla y la passphrase. */
function input(overrides: Partial<CustodyModelInput>): CustodyModelInput {
  return base({
    keys: [{ id: 'k1', label: 'K1', passphrase: true, passphraseStrength: 'random' }],
    policy: { type: 'key', key: 'k1' },
    ...overrides,
  });
}

const homes = (people: Record<string, string | undefined>) => (p: { id: string; name: string; role: 'owner' | 'heir' }) => ({
  ...p,
  ...(people[p.id] && { livesAt: people[p.id] }),
});

describe('la misma persona en dos sitios es un solo secuestro', () => {
  // La semilla en casa y la passphrase en la caja del banco; Yo entra en las dos.
  const model = (yo?: string) =>
    parse(
      input({
        people: [{ id: 'yo', name: 'Yo', role: 'owner' as const }].map(homes({ yo })),
        locations: [
          { id: 'casa', name: 'Casa', access: [{ person: 'yo' }] },
          { id: 'piso', name: 'Piso', access: [] },
          { id: 'banco', name: 'Banco', protection: 'bank-box', access: [{ person: 'yo' }] },
        ],
        artifacts: [
          { id: 'semilla', label: 'Semilla', medium: 'metal', contents: [{ type: 'seed', key: 'k1' }], location: 'casa' },
          { id: 'pass', label: 'Passphrase', medium: 'paper', contents: [{ type: 'passphrase', key: 'k1' }], location: 'banco' },
        ],
      }),
    );
  const cut = [coercion('yo', 'casa'), coercion('yo', 'banco')];

  it('una llave inglesa, llevarle al banco y un sitio más', () => {
    const m = model('casa');
    expect(simulateAttack(m, cut).canSpend).toBe(true);
    expect(coercionAssaults(cut, indexModel(m))).toEqual([0, 0]);
    expect(attackEffort(cut, indexModel(m))).toBe(ATTACK_EFFORT.coercion + COERCION_SURCHARGE['bank-box'] + EXTRA_SITE_SURCHARGE);
    expect(analyze(m).security.minEffort).toBe(ATTACK_EFFORT.coercion + COERCION_SURCHARGE['bank-box'] + EXTRA_SITE_SURCHARGE);
  });

  it('la caja del banco no suma además el recargo de no vivir allí', () => {
    const m = model('casa');
    expect(atomEfforts(cut, indexModel(m)).map((a) => a.effort)).toEqual([ATTACK_EFFORT.coercion, COERCION_SURCHARGE['bank-box']]);
    expect(cut.map((a) => coercionSurchargeReason(a, indexModel(m)))).toEqual([null, 'bank-box']);
    expect(coercionSurchargeReason(coercion('yo', 'casa'), indexModel(model('piso')))).toBe('away');
  });

  it('si no vive en casa, cogerle allí cuesta algo más', () => {
    const m = model('piso');
    expect(attackEffort(cut, indexModel(m))).toBe(
      ATTACK_EFFORT.coercion + COERCION_AWAY_SURCHARGE + COERCION_SURCHARGE['bank-box'] + EXTRA_SITE_SURCHARGE,
    );
    // Sin indicar, como si viviera en todas partes.
    expect(attackEffort(cut, indexModel(model()))).toBe(attackEffort(cut, indexModel(model('casa'))));
  });
});

describe('dos personas en el mismo sitio son un solo asalto', () => {
  // Cada una tiene su caja fuerte en casa: la semilla en la de Yo, la passphrase en la de Pareja.
  const model = (pareja?: string) =>
    parse(
      input({
        people: [
          { id: 'yo', name: 'Yo', role: 'owner' as const },
          { id: 'pareja', name: 'Pareja', role: 'heir' as const },
        ].map(homes({ yo: 'casa', pareja })),
        locations: [
          { id: 'casa', name: 'Casa', access: [{ person: 'yo' }, { person: 'pareja' }] },
          { id: 'piso', name: 'Piso', access: [] },
          { id: 'caja-yo', name: 'Caja de Yo', protection: 'home-safe', inside: 'casa', access: [{ person: 'yo' }] },
          { id: 'caja-pareja', name: 'Caja de Pareja', protection: 'home-safe', inside: 'casa', access: [{ person: 'pareja' }] },
        ],
        artifacts: [
          { id: 'semilla', label: 'Semilla', medium: 'metal', contents: [{ type: 'seed', key: 'k1' }], location: 'caja-yo' },
          { id: 'pass', label: 'Passphrase', medium: 'paper', contents: [{ type: 'passphrase', key: 'k1' }], location: 'caja-pareja' },
        ],
      }),
    );
  const cut = [coercion('yo', 'casa'), coercion('pareja', 'casa')];

  it('la segunda persona no encarece el asalto', () => {
    const m = model('casa');
    expect(simulateAttack(m, cut).canSpend).toBe(true);
    expect(atomEfforts(cut, indexModel(m))).toEqual([
      { effort: ATTACK_EFFORT.coercion, sameAssault: false },
      { effort: 0, sameAssault: true },
    ]);
    expect(attackEffort(cut, indexModel(m))).toBe(ATTACK_EFFORT.coercion);
  });

  it('si una no vive allí, hay que llevarla', () => {
    expect(attackEffort(cut, indexModel(model('piso')))).toBe(ATTACK_EFFORT.coercion + COERCION_AWAY_SURCHARGE);
  });
});

describe('quien solo sabe algo cae en su casa', () => {
  // La semilla en casa (Yo) y la passphrase solo en la memoria de Pareja, que no entra en ningún sitio.
  const model = (pareja?: string) =>
    parse(
      input({
        people: [
          { id: 'yo', name: 'Yo', role: 'owner' as const },
          { id: 'pareja', name: 'Pareja', role: 'heir' as const, knows: [{ type: 'passphrase' as const, key: 'k1' }] },
        ].map(homes({ yo: 'casa', pareja })),
        locations: [
          { id: 'casa', name: 'Casa', access: [{ person: 'yo' }] },
          { id: 'piso', name: 'Piso', access: [] },
        ],
        artifacts: [{ id: 'semilla', label: 'Semilla', medium: 'metal', contents: [{ type: 'seed', key: 'k1' }], location: 'casa' }],
      }),
    );
  const cut = [coercion('yo', 'casa'), coercion('pareja', null)];

  it('si vive con la otra víctima, o no consta dónde vive, es el mismo asalto', () => {
    expect(simulateAttack(model('casa'), cut).canSpend).toBe(true);
    expect(attackEffort(cut, indexModel(model('casa')))).toBe(ATTACK_EFFORT.coercion);
    expect(attackEffort(cut, indexModel(model()))).toBe(ATTACK_EFFORT.coercion);
  });

  it('si vive en otro sitio, son dos asaltos en dos sitios', () => {
    const m = model('piso');
    expect(coercionAssaults(cut, indexModel(m))).toEqual([0, 1]);
    expect(attackEffort(cut, indexModel(m))).toBe(2 * ATTACK_EFFORT.coercion + EXTRA_SITE_SURCHARGE);
  });
});

describe('propiedades', () => {
  const FIXTURES = ['todo-en-casa', 'distribuido-2de3', 'singlesig-passphrase'].map(loadFixture);
  const BASE = FIXTURES.map((m) => analyze(m).security.minEffort!);

  it('indicar dónde vive cada persona nunca abarata el robo', () => {
    fc.assert(
      fc.property(fc.nat(FIXTURES.length - 1), fc.array(fc.nat(10), { minLength: 4, maxLength: 4 }), (f, picks) => {
        const model = FIXTURES[f]!;
        const homed = model.people.reduce(
          (m, p, i) => setPersonHome(m, p.id, m.locations[picks[i % picks.length]! % m.locations.length]!.id),
          model,
        );
        expect(analyze(homed).security.minEffort!).toBeGreaterThanOrEqual(BASE[f]!);
      }),
      { numRuns: 25 },
    );
  }, 60_000);
});
