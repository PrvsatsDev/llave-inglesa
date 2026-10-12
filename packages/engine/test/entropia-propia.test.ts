import { checkIntegrity, type CustodyModelInput, type EntropySource } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, attackAtoms, createWorld, keyCompromise, originKey, simulateAttack, type AttackAtom } from '../src/index.ts';
import { ATTACK_EFFORT } from '../src/score.ts';
import { base, parse } from './helpers.ts';

/** Single-sig con la semilla en casa; la key sale de estas fuentes. */
const model = (sources: EntropySource[], key: Partial<CustodyModelInput['keys'][number]> = {}) =>
  parse(
    base({
      keys: [{ id: 'k1', label: 'K1', provenance: { sources }, ...key }],
      policy: { type: 'key', key: 'k1' },
      artifacts: [{ id: 'semilla', label: 'Semilla', medium: 'metal', contents: [{ type: 'seed', key: 'k1' }], location: 'casa' }],
    }),
  );

const bruteforce: AttackAtom = { type: 'weak-own-entropy', key: 'k1' };
const atoms = (m: ReturnType<typeof model>) => attackAtoms(createWorld(m));

describe('semilla solo de entropía propia', () => {
  it('por debajo de 128 bits se adivina por fuerza bruta, como un fallo publicado', () => {
    const weak = model([{ kind: 'dice', count: 20 }]);
    expect(atoms(weak)).toContainEqual(bruteforce);
    expect(simulateAttack(weak, [bruteforce]).canSpend).toBe(true);
    expect(analyze(weak).security.minEffort).toBe(ATTACK_EFFORT['weak-own-entropy']);
  });

  it('casi suficiente no basta: 49 dados (≈127 bits) siguen siendo débiles; 50, no', () => {
    expect(atoms(model([{ kind: 'dice', count: 49 }]))).toContainEqual(bruteforce);
    expect(atoms(model([{ kind: 'dice', count: 50 }]))).not.toContainEqual(bruteforce);
    expect(atoms(model([{ kind: 'coin', count: 100 }, { kind: 'dice', count: 11 }]))).not.toContainEqual(bruteforce);
  });

  it('sin número de tiradas, se supone lo peor y se avisa', () => {
    const unset = model([{ kind: 'dice' }]);
    expect(atoms(unset)).toContainEqual(bruteforce);
    expect(checkIntegrity(unset).map((i) => i.code)).toContain('entropy-count-unset');
    expect(checkIntegrity(model([{ kind: 'dice', count: 99 }])).map((i) => i.code)).not.toContain('entropy-count-unset');
  });

  it('una passphrase protege: con la semilla sola no se firma', () => {
    const withPassphrase = model([{ kind: 'dice', count: 20 }], { passphrase: true, passphraseStrength: 'random' });
    const result = simulateAttack(withPassphrase, [bruteforce]);
    expect(result.has({ kind: 'secret', secret: { type: 'seed', key: 'k1' } })).toBe(true);
    expect(result.canSpend).toBe(false);
  });

  it('con un RNG mezclado no hay fuerza bruta directa (el RNG cubre)', () => {
    expect(atoms(model([{ kind: 'dice', count: 20 }, { kind: 'device-rng', vendor: 'Coinkite' }]))).not.toContainEqual(bruteforce);
  });
});

describe('entropía propia mezclada con un RNG', () => {
  const coinkite = new Set([originKey({ kind: 'vendor', vendor: 'Coinkite' })]);
  const key = (dice: number | undefined) =>
    model([{ kind: 'device-rng', vendor: 'Coinkite' }, dice === undefined ? { kind: 'dice' } : { kind: 'dice', count: dice }], {
      // Verificada: el generador no pudo ignorar los dados, así que cuentan de verdad.
      provenance: {
        sources: [{ kind: 'device-rng', vendor: 'Coinkite' }, dice === undefined ? { kind: 'dice' } : { kind: 'dice', count: dice }],
        generatedBy: { vendor: 'SeedSigner' },
        independentlyVerified: true,
      },
    }).keys[0]!;

  it('si llega a 128 bits, protege aunque el RNG esté comprometido', () => {
    expect(keyCompromise(key(50), coinkite)).toBeNull();
  });

  it('si no llega, no protege: quien conoce el RNG adivina el resto', () => {
    expect(keyCompromise(key(1), coinkite)).toEqual([{ kind: 'vendor', vendor: 'Coinkite' }]);
    expect(keyCompromise(key(30), coinkite)).toEqual([{ kind: 'vendor', vendor: 'Coinkite' }]);
    expect(keyCompromise(key(undefined), coinkite)).toEqual([{ kind: 'vendor', vendor: 'Coinkite' }]);
  });

  it('con el RNG sano, la semilla resiste aunque los dados sean pocos', () => {
    expect(keyCompromise(key(1), new Set())).toBeNull();
  });
});
