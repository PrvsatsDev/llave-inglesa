import { addArtifact, addLocation, splitKey, updateArtifact, type CustodyModel, type SecretRef } from '@llave-inglesa/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyze, createWorld, derive, legitHoldings, seedKeys, simulateAttack, simulateLosses } from '../src/index.ts';
import { modelArb, shamirModelArb } from './arbitraries.ts';
import { loadFixture } from './helpers.ts';

/** Cada semilla de `key` escrita o memorizada pasa a ser todas sus shares, en el mismo sitio. */
function allSharesTogether(model: CustodyModel, key: string, k: number, n: number): CustodyModel {
  const m = splitKey(model, key, 'shamir', k, n);
  const swap = (s: SecretRef): SecretRef[] =>
    s.type === 'seed' && s.key === key ? Array.from({ length: n }, (_, i) => ({ type: 'share' as const, key, share: i + 1 })) : [s];
  return {
    ...m,
    artifacts: m.artifacts.map((a) => ({ ...a, contents: a.contents.flatMap(swap) })),
    people: m.people.map((p) => ({ ...p, knows: p.knows.flatMap(swap) })),
  };
}

const results = (m: CustodyModel) => {
  const a = analyze(m);
  return { security: a.security.cuts, minEffort: a.security.minEffort, losses: a.resilience.cuts, lockouts: a.resilience.lockouts, usability: a.usability, inheritance: a.inheritance.status };
};

describe('Shamir', () => {
  it('equivalencia: todas las shares de una key juntas valen lo mismo que su semilla en ese sitio', () => {
    fc.assert(
      fc.property(modelArb, fc.integer({ min: 1, max: 3 }), fc.integer({ min: 0, max: 2 }), (model, n, extra) => {
        const key = model.keys[0]!.id;
        const k = Math.min(n, 1 + extra);
        expect(results(allSharesTogether(model, key, k, n))).toEqual(results(model));
      }),
      { numRuns: 60 },
    );
  });

  // Todo en casa: K2 es una placa de metal en casa. Pasa a Shamir 2 de 3, con las shares en casa, el banco y los padres.
  const casa = loadFixture('todo-en-casa');
  const repartida = (() => {
    let m = splitKey(casa, 'k2', 'shamir', 2, 3);
    const banco = addLocation(m, 'Banco', 'physical');
    m = banco.model;
    const placa = m.artifacts.find((a) => a.contents.some((c) => c.type === 'seed' && c.key === 'k2'))!;
    m = updateArtifact(m, placa.id, { contents: [{ type: 'share', key: 'k2', share: 1 }] });
    for (const [share, location] of [[2, banco.id], [3, 'padres']] as const) {
      const a = addArtifact(m, location);
      m = updateArtifact(a.model, a.id, { contents: [{ type: 'share', key: 'k2', share }] });
    }
    return m;
  })();

  it('una share sola no da nada; dos, la semilla, y se explica por qué', () => {
    const una = simulateAttack(repartida, [{ type: 'burglary', location: 'casa' }]);
    expect(una.facts.has('secret:share:k2/1')).toBe(true);
    expect(una.facts.has('secret:seed:k2')).toBe(false);
    const dos = simulateAttack(repartida, [{ type: 'burglary', location: 'casa' }, { type: 'burglary', location: 'padres' }]);
    expect(dos.facts.get('secret:seed:k2')?.justification).toEqual({ rule: 'combine-shares', premises: ['secret:share:k2/1', 'secret:share:k2/3'] });
  });

  it('perder una share no pierde la key; perder dos, sí', () => {
    const una = simulateLosses(repartida, [{ type: 'destroy-location', location: 'padres', disaster: 'total' }]);
    expect(una.facts.has('secret:seed:k2')).toBe(true);
    const banco = repartida.locations.at(-1)!.id;
    const dos = simulateLosses(repartida, [{ type: 'destroy-location', location: 'padres', disaster: 'total' }, { type: 'destroy-location', location: banco, disaster: 'total' }]);
    expect(dos.facts.has('secret:seed:k2')).toBe(false);
  });

  it('un stateless sin indicar puede firmar una key Shamir solo si hay k shares escritas', () => {
    expect(seedKeys(repartida).has('k2')).toBe(true);
    const sinUna = { ...repartida, artifacts: repartida.artifacts.filter((a) => !a.contents.some((c) => c.type === 'share' && c.share === 3)) };
    const soloUna = { ...sinUna, artifacts: sinUna.artifacts.filter((a) => !a.contents.some((c) => c.type === 'share' && c.share === 2)) };
    expect(seedKeys(sinUna).has('k2')).toBe(true);
    expect(seedKeys(soloUna).has('k2')).toBe(false);
  });

  it('monotonía con keys Shamir: tener más nunca permite hacer menos', () => {
    fc.assert(
      fc.property(
        shamirModelArb.chain((m) =>
          fc.tuple(
            fc.constant(m),
            fc.subarray(m.people.map((p) => p.id)),
            fc.subarray(m.locations.map((l) => l.id)),
            fc.subarray(m.locations.map((l) => l.id)),
            fc.constantFrom('any' as const, 'secure' as const),
          ),
        ),
        ([model, people, l1, l2, mode]) => {
          const world = createWorld(model);
          const small = derive(world, { people, locations: l1 }, mode);
          const big = derive(world, { people, locations: [...l1, ...l2] }, mode);
          for (const id of small.facts.keys()) expect(big.facts.has(id)).toBe(true);
          if (derive(world, legitHoldings(world), 'secure').canSpend) expect(derive(world, legitHoldings(world), 'any').canSpend).toBe(true);
        },
      ),
    );
  });
});
