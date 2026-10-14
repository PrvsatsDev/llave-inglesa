import { analyzeMiniscript, miniscriptToString } from '@llave-inglesa/bitcoin';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { convertShape, miniscriptPolicy, policyMiniscript, policyShape, SHAPE_KINDS, SHAPE_MIN_KEYS, shapePolicy, type Policy, type PolicyShape } from '../src/index.ts';

const text = (shape: PolicyShape) => {
  const ms = policyMiniscript(shapePolicy(shape));
  return ms && miniscriptToString(ms, (k) => k);
};

describe('política → Miniscript', () => {
  it('escribe las plantillas con las formas habituales', () => {
    expect(text({ kind: 'plain', k: 2, keys: ['a', 'b', 'c'] })).toBe('multi(2,a,b,c)');
    expect(text({ kind: 'inheritance', k: 1, keys: ['a'], recovery: 'r', blocks: 25920 })).toBe('or_d(pk(a),and_v(v:pkh(r),older(25920)))');
    expect(text({ kind: 'inheritance', k: 2, keys: ['a', 'b', 'c'], recovery: 'r', blocks: 100 })).toBe('or_d(multi(2,a,b,c),and_v(v:pkh(r),older(100)))');
    expect(text({ kind: 'decaying', k: 2, keys: ['a', 'b', 'c'], blocks: 100 })).toBe('thresh(2,pk(a),s:pk(b),s:pk(c),sln:older(100))');
    expect(text({ kind: 'expanding', k: 2, keys: ['a', 'b', 'c'], extra: 'd', blocks: 100 })).toBe('thresh(2,pk(a),s:pk(b),s:pk(c),aln:and_v(v:pkh(d),older(100)))');
  });

  it('no escribe lo que no sería seguro', () => {
    expect(policyMiniscript({ type: 'older', blocks: 10 })).toBeNull();
    expect(policyMiniscript({ type: 'thresh', k: 1, of: [{ type: 'key', key: 'a' }, { type: 'older', blocks: 10 }] })).toBeNull();
  });

  const shapes: fc.Arbitrary<PolicyShape> = fc
    .tuple(fc.constantFrom(...SHAPE_KINDS), fc.integer({ min: 1, max: 8 }), fc.nat(10), fc.integer({ min: 1, max: 65535 }))
    .map(([kind, n, k, blocks]) => {
      const all = Array.from({ length: Math.max(n, SHAPE_MIN_KEYS[kind]) }, (_, i) => `k${i + 1}`);
      return convertShape({ kind: 'decaying', k, keys: all, blocks }, kind)!;
    });

  it('propiedad: toda plantilla da un Miniscript seguro que se vuelve a leer como la misma plantilla', () => {
    fc.assert(
      fc.property(shapes, (shape) => {
        const ms = policyMiniscript(shapePolicy(shape));
        expect(ms).not.toBeNull();
        expect(analyzeMiniscript(ms!).sane).toBe(true);
        expect(policyShape(miniscriptPolicy(ms!)!)).toEqual(shape);
      }),
    );
  });

  /** ¿Se gasta con estas keys cuando las monedas llevan `age` bloques sin moverse? */
  const spends = (p: Policy, keys: ReadonlySet<string>, age: number): boolean =>
    p.type === 'key' ? keys.has(p.key) : p.type === 'older' ? age >= p.blocks : p.of.filter((c) => spends(c, keys, age)).length >= p.k;

  const KEYS = ['a', 'b', 'c', 'd', 'e'];
  const policies: fc.Arbitrary<Policy> = fc.letrec<{ p: Policy }>((tie) => ({
    p: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      fc.constantFrom(...KEYS).map((key): Policy => ({ type: 'key', key })),
      fc.integer({ min: 1, max: 300 }).map((blocks): Policy => ({ type: 'older', blocks })),
      fc
        .array(tie('p'), { minLength: 1, maxLength: 4 })
        .chain((of) => fc.integer({ min: 1, max: of.length }).map((k): Policy => ({ type: 'thresh', k, of }))),
    ),
  })).p;

  it('propiedad: lo que se escribe gasta en los mismos casos que la política, y se vuelve a leer igual', () => {
    fc.assert(
      fc.property(policies, fc.subarray(KEYS), fc.integer({ min: 0, max: 400 }), (policy, keys, age) => {
        const ms = policyMiniscript(policy);
        if (!ms) return;
        expect(analyzeMiniscript(ms).sane).toBe(true);
        const lifted = miniscriptPolicy(ms)!;
        expect(spends(lifted, new Set(keys), age)).toBe(spends(policy, new Set(keys), age));
      }),
      { numRuns: 500 },
    );
  });
});
