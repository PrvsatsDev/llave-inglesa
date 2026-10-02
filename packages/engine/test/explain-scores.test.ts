import { describe, expect, it } from 'vitest';
import {
  analyze,
  explain,
  HEIR_FRAGILITY_WEIGHT,
  inheritanceBreakdown,
  rarityScore,
  ownerDeaths,
  resilienceBreakdown,
  securityBreakdown,
  simulateInheritance,
  simulateSigning,
} from '../src/index.ts';
import { loadFixture } from './helpers.ts';

const FIXTURES = ['todo-en-casa', 'distribuido-2de3', 'singlesig-passphrase'];

describe.each(FIXTURES)('el porqué de las puntuaciones (%s)', (name) => {
  const model = loadFixture(name);
  const a = analyze(model);

  it('el desglose de seguridad y resiliencia suma la puntuación mostrada', () => {
    const sec = securityBreakdown(a.security.minEffort, a.security.cheapRoutes);
    expect(sec.score).toBe(a.security.score);
    const res = resilienceBreakdown(a.resilience.minRarity, a.resilience.combinedRarity, a.resilience.lockoutMinRarity);
    if (a.resilience.recoverableNow) expect(res.score).toBe(a.resilience.score);
    for (const b of [sec, res]) expect(b.score).toBeLessThanOrEqual(b.base);
  });

  it('con las ubicaciones de la usabilidad, los titulares firman, y hay un árbol que lo explica', () => {
    expect(a.usability.locations).not.toBeNull();
    const d = simulateSigning(model, a.usability.locations!);
    expect(d.canSpend).toBe(true);
    expect(explain(d, 'spend')).not.toBeNull();
  });

  it('la herencia: si los herederos recuperan, lo hacen yendo solo a sus ubicaciones', () => {
    expect(ownerDeaths(model).length).toBeGreaterThan(0);
    const d = simulateInheritance(model, a.inheritance.locations ?? undefined);
    expect(d.canSpend).toBe(a.inheritance.status === 'ok');
    if (a.inheritance.status === 'ok') expect(explain(d, 'spend')).not.toBeNull();
  });
});

describe('desglose de seguridad', () => {
  it('varias vías casi igual de baratas restan, con tope', () => {
    expect(securityBreakdown(2, 1).penalties).toEqual([]);
    expect(securityBreakdown(2, 3).penalties).toEqual([{ reason: 'exposure', points: 4 }]);
    expect(securityBreakdown(2, 10).penalties[0]!.points).toBe(6);
  });

  it('sin ningún robo encontrado, 100 sin descuentos', () => {
    expect(securityBreakdown(null, 0)).toEqual({ base: 100, penalties: [], score: 100 });
  });
});

describe('desglose de herencia', () => {
  it('sin fragilidad, la facilidad tal cual', () => {
    expect(inheritanceBreakdown(1, null)).toEqual({ base: 100, penalties: [], score: 100 });
  });

  it('la fragilidad resta, como mucho 40', () => {
    expect(inheritanceBreakdown(1, 1.5).penalties).toEqual([{ reason: 'heir-fragility', points: Math.round(HEIR_FRAGILITY_WEIGHT * (100 - rarityScore(1.5))) }]);
    expect(inheritanceBreakdown(1, 0).score).toBe(60);
    expect(inheritanceBreakdown(2, 0).score).toBe(50);
  });

  it('si no se puede heredar, 0 sin más', () => {
    expect(inheritanceBreakdown(null, null)).toEqual({ base: 0, penalties: [], score: 0 });
  });
});
