import type { CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, inheritanceBreakdown, NO_DESCRIPTOR_PENALTY, resilienceBreakdown } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

/** Todo a mano en casa (2 de 3) quitando descriptores: todos, o todos menos el de `keep`. */
const withoutDescriptors = (keep?: string): CustodyModel => {
  const model = loadFixture('todo-en-casa');
  return { ...model, artifacts: model.artifacts.filter((a) => a.id === keep || !a.contents.some((c) => c.type === 'descriptor')) };
};

describe('multisig sin descriptor', () => {
  const full = analyze(loadFixture('todo-en-casa'));

  it('con descriptor no resta nada', () => {
    expect(full.resilience.noDescriptorCopy).toBe(false);
    expect(full.inheritance.rebuild).toBe(false);
  });

  it('sin ninguna copia: la herencia resta 35 (reconstruir con las tres semillas) y la resiliencia 15', () => {
    const a = analyze(withoutDescriptors());
    expect(a.inheritance).toMatchObject({ status: 'ok', rebuild: true, visits: 3 });
    expect(a.inheritance.score).toBe(inheritanceBreakdown(3, a.inheritance.lossCombinedRarity).score - NO_DESCRIPTOR_PENALTY.inheritance);
    expect(a.resilience.noDescriptorCopy).toBe(true);
    const r = a.resilience;
    expect(r.score).toBe(resilienceBreakdown(r.minRarity, r.combinedRarity, r.lockoutMinRarity).score - NO_DESCRIPTOR_PENALTY.resilience);
  });

  it('con una copia del descriptor aunque cueste un viaje más, se elige esa vía y no resta', () => {
    const a = analyze(withoutDescriptors('desc-padres'));
    expect(a.inheritance).toMatchObject({ status: 'ok', rebuild: false });
    expect(a.inheritance.locations).toContain('padres');
    expect(a.resilience.noDescriptorCopy).toBe(false);
  });

  it('single-sig no tiene descriptor que echar en falta', () => {
    const a = analyze(loadFixture('singlesig-passphrase'));
    expect(a.resilience.noDescriptorCopy).toBe(false);
    expect(a.inheritance.rebuild).toBe(false);
  });

  it('el desglose lo enseña como una resta más', () => {
    expect(inheritanceBreakdown(1, null, true)).toEqual({ base: 100, penalties: [{ reason: 'no-descriptor', points: 35 }], score: 65 });
    expect(resilienceBreakdown(6, 6, null, true).penalties).toEqual([{ reason: 'no-descriptor', points: 15 }]);
  });
});
