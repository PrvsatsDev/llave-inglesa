import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addShapeKey,
  convertShape,
  parseModel,
  policyShape,
  removeShapeKey,
  setShapeSpecialKey,
  SHAPE_KINDS,
  SHAPE_MIN_KEYS,
  shapeKeys,
  shapePolicy,
  shapeThresholds,
  spendableWithoutKeys,
  type PolicyShape,
} from '../src/index.ts';

const fixture = (name: string) => {
  const r = parseModel(JSON.parse(readFileSync(new URL(`../../../fixtures/${name}.json`, import.meta.url), 'utf8')));
  if (!r.ok) throw new Error(name);
  return r.model;
};

describe('formas de política', () => {
  it('reconoce los ejemplos', () => {
    expect(policyShape(fixture('singlesig-passphrase').policy)).toMatchObject({ kind: 'plain', k: 1 });
    expect(policyShape(fixture('distribuido-2de3').policy)).toMatchObject({ kind: 'plain', k: 2, keys: ['k1', 'k2', 'k3'] });
    expect(policyShape(fixture('referencia/r13-recuperacion-heredera').policy)).toEqual({ kind: 'inheritance', k: 1, keys: ['k1'], recovery: 'k2', blocks: 25920 });
    expect(policyShape(fixture('referencia/r14-2de3-se-relaja').policy)).toEqual({ kind: 'decaying', k: 2, keys: ['k1', 'k2', 'k3'], blocks: 52560 });
    expect(policyShape(fixture('referencia/r15-2de3-se-amplia').policy)).toEqual({ kind: 'expanding', k: 2, keys: ['k1', 'k2', 'k3'], extra: 'k4', blocks: 52560 });
  });

  it('no reconoce políticas que repiten keys ni otras formas', () => {
    expect(policyShape({ type: 'thresh', k: 1, of: [{ type: 'key', key: 'a' }, { type: 'key', key: 'a' }] })).toBeNull();
    expect(policyShape({ type: 'older', blocks: 10 })).toBeNull();
    // Decreciente con k = 1: bastaría con esperar.
    expect(policyShape({ type: 'thresh', k: 1, of: [{ type: 'key', key: 'a' }, { type: 'older', blocks: 10 }] })).toBeNull();
  });

  it('cambiar de forma conserva las keys, y la de recuperación pasa a ser la extra', () => {
    const r13 = policyShape(fixture('referencia/r13-recuperacion-heredera').policy)!;
    expect(convertShape(r13, 'expanding')).toBeNull();
    const three = addShapeKey(r13, 'k3');
    expect(convertShape(three, 'expanding')).toEqual({ kind: 'expanding', k: 2, keys: ['k1', 'k3'], extra: 'k2', blocks: 25920 });
    expect(convertShape(three, 'plain')).toEqual({ kind: 'plain', k: 1, keys: ['k1', 'k3', 'k2'] });
  });

  it('elegir otra key de recuperación la intercambia con la que lo era', () => {
    const r15 = policyShape(fixture('referencia/r15-2de3-se-amplia').policy)!;
    expect(setShapeSpecialKey(r15, 'k1')).toMatchObject({ keys: ['k4', 'k2', 'k3'], extra: 'k1' });
  });

  it('quitar la key de recuperación deja la sencilla; quitar principales baja a la forma más parecida', () => {
    const r15 = policyShape(fixture('referencia/r15-2de3-se-amplia').policy)!;
    expect(removeShapeKey(r15, 'k4')).toEqual({ kind: 'plain', k: 2, keys: ['k1', 'k2', 'k3'] });
    expect(removeShapeKey(removeShapeKey(r15, 'k1')!, 'k2')).toEqual({ kind: 'inheritance', k: 1, keys: ['k3'], recovery: 'k4', blocks: 52560 });
    const r13 = policyShape(fixture('referencia/r13-recuperacion-heredera').policy)!;
    expect(removeShapeKey(r13, 'k1')).toEqual({ kind: 'plain', k: 1, keys: ['k2'] });
  });

  const shapes: fc.Arbitrary<PolicyShape> = fc
    .tuple(fc.constantFrom(...SHAPE_KINDS), fc.integer({ min: 1, max: 6 }), fc.nat(10), fc.integer({ min: 1, max: 65535 }))
    .map(([kind, n, k, blocks]) => {
      const all = Array.from({ length: Math.max(n, SHAPE_MIN_KEYS[kind]) }, (_, i) => `k${i + 1}`);
      return convertShape({ kind: 'decaying', k, keys: all, blocks }, kind)!;
    });

  it('propiedad: forma → política → forma es la identidad, y ninguna se gasta sin firmas', () => {
    fc.assert(
      fc.property(shapes, (shape) => {
        const { min, max } = shapeThresholds(shape.kind, shape.keys.length);
        expect(shape.k).toBeGreaterThanOrEqual(min);
        expect(shape.k).toBeLessThanOrEqual(max);
        const policy = shapePolicy(shape);
        expect(policyShape(policy)).toEqual(shape);
        expect(spendableWithoutKeys(policy)).toBe(false);
      }),
    );
  });

  it('propiedad: quitar una key deja una forma válida sin esa key', () => {
    fc.assert(
      fc.property(shapes, fc.nat(10), (shape, i) => {
        const keys = shapeKeys(shape);
        const gone = keys[i % keys.length]!;
        const next = removeShapeKey(shape, gone);
        if (keys.length === 1) {
          expect(next).toBeNull();
          return;
        }
        expect(shapeKeys(next!).sort()).toEqual(keys.filter((k) => k !== gone).sort());
        expect(policyShape(shapePolicy(next!))).toEqual(next);
      }),
    );
  });
});
