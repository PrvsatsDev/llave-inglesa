import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CustodyModel } from '@llave-inglesa/domain';
import { attackAtoms, attackHoldings, createWorld, derive, legitHoldings, minimalCuts } from '../src/index.ts';
import { modelArb } from './arbitraries.ts';

const subset = <T>(xs: readonly T[]) => fc.subarray([...xs]);

describe('propiedades del motor', () => {
  it('monotonía: tener más nunca permite hacer menos', () => {
    fc.assert(
      fc.property(
        modelArb.chain((m) => fc.tuple(
          fc.constant(m),
          subset(m.people.map((p) => p.id)), subset(m.locations.map((l) => l.id)),
          subset(m.people.map((p) => p.id)), subset(m.locations.map((l) => l.id)),
          fc.constantFrom('any' as const, 'secure' as const),
        )),
        ([model, p1, l1, p2, l2, mode]) => {
          const world = createWorld(model);
          const small = derive(world, { people: p1, locations: l1 }, mode);
          const big = derive(world, { people: [...p1, ...p2], locations: [...l1, ...l2] }, mode);
          for (const id of small.facts.keys()) expect(big.facts.has(id)).toBe(true);
        },
      ),
    );
  });

  it('monotonía en el tiempo: esperar más nunca permite hacer menos', () => {
    fc.assert(
      fc.property(
        modelArb.chain((m) => fc.tuple(fc.constant(m), fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 4 }))),
        ([model, e1, e2]) => {
          const world = createWorld(model);
          const h = legitHoldings(world);
          const early = derive(world, { ...h, elapsed: Math.min(e1, e2) }, 'any');
          const late = derive(world, { ...h, elapsed: Math.max(e1, e2) }, 'any');
          for (const id of early.facts.keys()) if (!id.startsWith('timelock:')) expect(late.facts.has(id)).toBe(true);
          if (early.canSpend) expect(late.canSpend).toBe(true);
          if (late.canSpend) expect(late.wait).toBeLessThanOrEqual(Math.max(e1, e2));
        },
      ),
    );
  });

  it('si se puede firmar de forma segura, también de cualquier forma', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const world = createWorld(model);
        const h = legitHoldings(world);
        if (derive(world, h, 'secure').canSpend) expect(derive(world, h, 'any').canSpend).toBe(true);
      }),
    );
  });

  it('añadir un backup nunca empeora la recuperabilidad', () => {
    fc.assert(
      fc.property(
        modelArb.chain((m) => fc.tuple(fc.constant(m), fc.constantFrom(...m.locations.map((l) => l.id)), fc.constantFrom(...m.keys.map((k) => k.id)))),
        ([model, location, key]) => {
          const recoverable = (m: CustodyModel) => {
            const w = createWorld(m);
            return derive(w, legitHoldings(w), 'any').canSpend;
          };
          const extra = { id: 'extra', label: 'Extra', medium: 'metal' as const, contents: [{ type: 'seed' as const, key }], lockedBy: [], location };
          if (recoverable(model)) expect(recoverable({ ...model, artifacts: [...model.artifacts, extra] })).toBe(true);
        },
      ),
    );
  });

  it('cortes de robo: todos funcionan y ningún subconjunto estricto funciona', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const world = createWorld(model);
        const steals = (atoms: ReturnType<typeof attackAtoms>) => derive(world, attackHoldings(world, atoms), 'any').canSpend;
        for (const cut of minimalCuts(attackAtoms(world), steals, 2)) {
          expect(steals(cut)).toBe(true);
          cut.forEach((_, i) => expect(steals(cut.filter((__, j) => j !== i))).toBe(false));
        }
      }),
      { numRuns: 50 },
    );
  });
});
