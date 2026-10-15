import { BLOCKS_PER_DAY, type Policy } from '@llave-inglesa/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { satisfy, spendStages, type SpendStage } from '../src/index.ts';

const key = (k: string): Policy => ({ type: 'key', key: k });
const older = (days: number): Policy => ({ type: 'older', blocks: days * BLOCKS_PER_DAY });
const thresh = (k: number, ...of: Policy[]): Policy => ({ type: 'thresh', k, of });
const YEAR = 365 * BLOCKS_PER_DAY;

describe('formas de gastar por etapas', () => {
  it('Liana: K1 y K2 siempre; tras un año, 2 cualesquiera de las tres', () => {
    const liana = thresh(1, thresh(2, thresh(2, key('k1'), key('k2'), key('k3')), older(365)), thresh(2, key('k1'), key('k2')));
    expect(spendStages(liana)).toEqual([
      { wait: 0, groups: [{ k: 2, keys: ['k1', 'k2'] }] },
      { wait: YEAR, groups: [{ k: 2, keys: ['k1', 'k2', 'k3'] }] },
    ]);
  });

  it('herencia simple y multisig decreciente', () => {
    expect(spendStages(thresh(1, thresh(2, key('a'), key('b')), thresh(2, key('c'), older(365))))).toEqual([
      { wait: 0, groups: [{ k: 2, keys: ['a', 'b'] }] },
      { wait: YEAR, groups: [{ k: 2, keys: ['a', 'b'] }, { k: 1, keys: ['c'] }] },
    ]);
    expect(spendStages(thresh(2, key('a'), key('b'), key('c'), older(365)))).toEqual([
      { wait: 0, groups: [{ k: 2, keys: ['a', 'b', 'c'] }] },
      { wait: YEAR, groups: [{ k: 1, keys: ['a', 'b', 'c'] }] },
    ]);
  });

  it('lo que no son todas las combinaciones va por separado', () => {
    expect(spendStages(thresh(1, thresh(2, key('a'), key('b')), thresh(2, key('b'), key('c'))))).toEqual([
      { wait: 0, groups: [{ k: 2, keys: ['a', 'b'] }, { k: 2, keys: ['b', 'c'] }] },
    ]);
  });

  it('se rinde si hay demasiadas combinaciones', () => {
    const many = thresh(8, ...Array.from({ length: 16 }, (_, i) => key(`k${i}`)));
    expect(spendStages(many)).toBeNull();
  });

  // Cada etapa dice justo lo que satisfy permite: con las keys de un grupo se gasta, y sin ninguna de ellas no.
  const policies: fc.Arbitrary<Policy> = fc.letrec<{ p: Policy }>((tie) => ({
    p: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      fc.constantFrom('a', 'b', 'c', 'd').map(key),
      fc.constantFrom(30, 365).map(older),
      fc.array(tie('p'), { minLength: 1, maxLength: 3 }).chain((of) => fc.integer({ min: 1, max: of.length }).map((k) => thresh(k, ...of))),
    ),
  })).p;
  const choices = (g: SpendStage['groups'][number]): string[][] => {
    const out: string[][] = [];
    const go = (from: number, acc: string[]) => {
      if (acc.length === g.k) return void out.push(acc);
      for (let i = from; i < g.keys.length; i++) go(i + 1, [...acc, g.keys[i]!]);
    };
    go(0, []);
    return out;
  };

  it('propiedad: cada combinación de cada etapa basta pasada su espera, y no antes si es nueva', () => {
    fc.assert(
      fc.property(policies, (policy) => {
        const stages = spendStages(policy);
        if (!stages) return;
        for (const stage of stages) {
          for (const set of stage.groups.flatMap(choices)) {
            expect(satisfy(policy, new Set(set), stage.wait)).not.toBeNull();
            // Con una key menos, no basta (son mínimos).
            for (const k of set) expect(satisfy(policy, new Set(set.filter((x) => x !== k)), stage.wait)).toBeNull();
          }
        }
        // Con todas las keys y todo el tiempo del mundo, hay al menos una etapa si la política se puede cumplir.
        if (satisfy(policy, new Set(['a', 'b', 'c', 'd']), Number.POSITIVE_INFINITY)) expect(stages.length).toBeGreaterThan(0);
      }),
    );
  });
});
