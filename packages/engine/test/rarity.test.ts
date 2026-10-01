import { describe, expect, it } from 'vitest';
import { analyze, combinedRarity, createWorld, cutRarity, lockoutPenalty, lossRarity, LOSS_RARITY, rarityScore, resilienceBreakdown } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

const casa = loadFixture('todo-en-casa'); // metal-k2 (acero) y desc-casa (papel) en casa
const index = createWorld(casa).index;

describe('rareza de las desgracias', () => {
  it('perder acero es más raro que perder papel; la pérdida del acceso, lo más raro', () => {
    expect(lossRarity({ type: 'item-loss', item: 'metal-k2' }, index)).toBe(LOSS_RARITY['steel-loss']);
    expect(lossRarity({ type: 'item-loss', item: 'desc-casa' }, index)).toBe(LOSS_RARITY['item-loss']);
    expect(lossRarity({ type: 'destroy-location', location: 'casa', disaster: 'total' }, index)).toBe(LOSS_RARITY.total.physical);
    expect(lossRarity({ type: 'destroy-location', location: 'casa', disaster: 'fire' }, index)).toBeLessThan(LOSS_RARITY.total.physical);
  });

  it('varias a la vez suman su rareza', () => {
    expect(cutRarity([{ type: 'forget', person: 'yo' }, { type: 'death', person: 'pareja' }], index)).toBe(LOSS_RARITY.forget + LOSS_RARITY.death);
  });

  it('varias vías se suman como probabilidades: tres de rareza 2 equivalen a ≈1,52', () => {
    expect(combinedRarity([2, 2, 2])).toBeCloseTo(2 - Math.log10(3));
    expect(combinedRarity([2])).toBe(2);
    expect(combinedRarity([])).toBeNull();
  });

  it('el desglose: base por la más probable, menos las demás vías y el bloqueo', () => {
    const b = resilienceBreakdown(2, 2 - Math.log10(3), 2.5);
    expect(b.base).toBe(rarityScore(2));
    expect(b.penalties.map((p) => p.reason)).toEqual(['other-routes', 'lockout']);
    expect(b.score).toBe(rarityScore(2 - Math.log10(3)) - lockoutPenalty(2.5));
  });

  it('las vías salen ordenadas de la más probable a la menos', () => {
    const r = analyze(casa).resilience;
    expect(r.rarities).toEqual([...r.rarities].sort((x, y) => x - y));
    expect(r.minRarity).toBe(r.rarities[0]);
  });

  it('pasar una placa de acero a papel hace los fondos más fáciles de perder', () => {
    const paper = { ...casa, artifacts: casa.artifacts.map((a) => (a.id === 'metal-k2' ? { ...a, medium: 'paper' as const } : a)) };
    expect(analyze(paper).resilience.score).toBeLessThan(analyze(casa).resilience.score);
  });
});
