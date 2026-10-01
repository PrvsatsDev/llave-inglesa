import { indexModel, parseModel, updateKey } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, attackAtoms, atomEffort, createWorld, PASSPHRASE_EFFORT, simulateAttack, type AttackAtom } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

// K1 en una Coldcard en casa, semilla en metal en el banco, passphrase memorizada y en papel en casa de los padres.
const model = loadFixture('singlesig-passphrase');
const strength = (s: 'weak' | 'phrase' | 'random' | undefined) => updateKey(model, 'k1', { passphraseStrength: s });
const bruteforce = (m: typeof model) => attackAtoms(createWorld(m)).filter((a) => a.type === 'passphrase-bruteforce');
const bank: AttackAtom = { type: 'burglary', location: 'banco' };

describe('fortaleza de la passphrase', () => {
  it('una aleatoria larga no se intenta adivinar; débil y frase sí, con su esfuerzo', () => {
    expect(bruteforce(strength('random'))).toEqual([]);
    expect(bruteforce(strength('weak'))).toEqual([{ type: 'passphrase-bruteforce', key: 'k1', strength: 'weak' }]);
    expect(atomEffort(bruteforce(strength('phrase'))[0]!, indexModel(strength('phrase')))).toBe(PASSPHRASE_EFFORT.phrase);
  });

  it('sin indicar se trata como débil, con un aviso', () => {
    expect(bruteforce(strength(undefined))[0]).toMatchObject({ strength: 'weak' });
    const r = parseModel(strength(undefined));
    expect(r.ok && r.warnings.map((w) => w.code)).toContain('passphrase-strength-unset');
  });

  it('solo sirve con la semilla en la mano', () => {
    const [guess] = bruteforce(strength('weak'));
    expect(simulateAttack(strength('weak'), [guess!]).canSpend).toBe(false);
    const d = simulateAttack(strength('weak'), [bank, guess!]);
    expect(d.canSpend).toBe(true);
    expect(d.facts.get('secret:passphrase:k1')?.justification).toMatchObject({ rule: 'passphrase-bruteforce', premises: ['secret:seed:k1'] });
  });

  it('una passphrase débil abarata el robo; una aleatoria larga no', () => {
    const weak = analyze(strength('weak')).security;
    const random = analyze(strength('random')).security;
    expect(weak.score).toBeLessThan(random.score);
    expect(weak.cuts).toContainEqual([bank, { type: 'passphrase-bruteforce', key: 'k1', strength: 'weak' }]);
  });

  it('sin passphrase no hay nada que adivinar (y la fortaleza queda latente)', () => {
    const off = updateKey(strength('weak'), 'k1', { passphrase: false });
    expect(bruteforce(off)).toEqual([]);
    expect(off.keys[0]!.passphraseStrength).toBe('weak');
  });
});
