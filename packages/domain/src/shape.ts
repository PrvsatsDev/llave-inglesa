import { BLOCKS_PER_DAY, MAX_OLDER_BLOCKS, type Id, type Policy } from './schema.ts';

/**
 * Formas de política que la interfaz sabe editar (plantillas). Cualquier otra política se puede tener (un fichero
 * escrito a mano), pero solo se lee.
 *
 * - `plain`: k de n, sin espera (con una sola key, single-sig).
 * - `inheritance`: herencia simple (en Liana, «simple inheritance»): k de las keys principales, o la key de
 *   recuperación sola pasada la espera.
 * - `decaying`: multisig decreciente («decaying multisig»): k de n, o k − 1 de n pasada la espera.
 * - `expanding`: multisig ampliable («expanding multisig»): k de n, y pasada la espera la key extra cuenta como una más.
 */
export type PolicyShape =
  | { kind: 'plain'; k: number; keys: Id[] }
  | { kind: 'inheritance'; k: number; keys: Id[]; recovery: Id; blocks: number }
  | { kind: 'decaying'; k: number; keys: Id[]; blocks: number }
  | { kind: 'expanding'; k: number; keys: Id[]; extra: Id; blocks: number };
export type ShapeKind = PolicyShape['kind'];
export const SHAPE_KINDS: readonly ShapeKind[] = ['plain', 'inheritance', 'decaying', 'expanding'];

/** Espera de una plantilla nueva: unos 6 meses. */
export const DEFAULT_SHAPE_BLOCKS = 180 * BLOCKS_PER_DAY;

/** Keys que necesita cada forma en total (contando la de recuperación o la extra). */
export const SHAPE_MIN_KEYS: Readonly<Record<ShapeKind, number>> = { plain: 1, inheritance: 2, decaying: 2, expanding: 3 };

/** Umbrales posibles (k) de una forma con `n` keys principales. Decreciente y ampliable son multisig: k ≥ 2. */
export function shapeThresholds(kind: ShapeKind, n: number): { min: number; max: number } {
  return { min: kind === 'decaying' || kind === 'expanding' ? 2 : 1, max: n };
}

const keyLeaf = (key: Id): Policy => ({ type: 'key', key });
const flat = (k: number, keys: readonly Id[]): Policy => (keys.length === 1 ? keyLeaf(keys[0]!) : { type: 'thresh', k, of: keys.map(keyLeaf) });
const afterWait = (key: Id, blocks: number): Policy => ({ type: 'thresh', k: 2, of: [keyLeaf(key), { type: 'older', blocks }] });

/** La política de una forma. */
export function shapePolicy(shape: PolicyShape): Policy {
  switch (shape.kind) {
    case 'plain':
      return flat(shape.k, shape.keys);
    case 'inheritance':
      return { type: 'thresh', k: 1, of: [flat(shape.k, shape.keys), afterWait(shape.recovery, shape.blocks)] };
    case 'decaying':
      return { type: 'thresh', k: shape.k, of: [...shape.keys.map(keyLeaf), { type: 'older', blocks: shape.blocks }] };
    case 'expanding':
      return { type: 'thresh', k: shape.k, of: [...shape.keys.map(keyLeaf), afterWait(shape.extra, shape.blocks)] };
  }
}

const leafKeys = (of: readonly Policy[]): Id[] | null => (of.every((p) => p.type === 'key') ? of.map((p) => (p as { key: Id }).key) : null);

/** Rama «key tras esperar»: `thresh(2, key, older)`. */
function waitBranch(p: Policy | undefined): { key: Id; blocks: number } | null {
  if (p?.type !== 'thresh' || p.k !== 2 || p.of.length !== 2) return null;
  const [a, b] = p.of;
  return a?.type === 'key' && b?.type === 'older' ? { key: a.key, blocks: b.blocks } : null;
}

/** Plano: una key, o k de n keys. */
function flatShape(p: Policy): { k: number; keys: Id[] } | null {
  if (p.type === 'key') return { k: 1, keys: [p.key] };
  if (p.type !== 'thresh') return null;
  const keys = leafKeys(p.of);
  return keys && p.k <= keys.length ? { k: p.k, keys } : null;
}

/** La forma de una política, o null si no es una de las plantillas (o repite keys). */
export function policyShape(policy: Policy): PolicyShape | null {
  const shape = recognize(policy);
  if (!shape) return null;
  const all = shapeKeys(shape);
  return new Set(all).size === all.length ? shape : null;
}

function recognize(policy: Policy): PolicyShape | null {
  const plain = flatShape(policy);
  if (plain) return { kind: 'plain', ...plain };
  if (policy.type !== 'thresh') return null;
  const { k, of } = policy;
  const last = of[of.length - 1];
  const rest = leafKeys(of.slice(0, -1));
  if (k === 1 && of.length === 2) {
    const primary = flatShape(of[0]!);
    const branch = waitBranch(last);
    if (primary && branch) return { kind: 'inheritance', ...primary, recovery: branch.key, blocks: branch.blocks };
  }
  if (!rest || k < 2 || k > rest.length) return null;
  if (last?.type === 'older') return { kind: 'decaying', k, keys: rest, blocks: last.blocks };
  const branch = waitBranch(last);
  if (branch) return { kind: 'expanding', k, keys: rest, extra: branch.key, blocks: branch.blocks };
  return null;
}

/** Todas las keys de la forma: las principales y, al final, la de recuperación o la extra. */
export function shapeKeys(shape: PolicyShape): Id[] {
  return shape.kind === 'inheritance' ? [...shape.keys, shape.recovery] : shape.kind === 'expanding' ? [...shape.keys, shape.extra] : [...shape.keys];
}

/** Key aparte de la forma (la de recuperación o la extra), si tiene. */
export function shapeSpecialKey(shape: PolicyShape): Id | null {
  return shape.kind === 'inheritance' ? shape.recovery : shape.kind === 'expanding' ? shape.extra : null;
}

const shapeBlocks = (shape: PolicyShape) => (shape.kind === 'plain' ? null : shape.blocks);
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(min, Math.round(v)), max);

/**
 * La forma `kind` con las mismas keys, umbral y espera (en lo posible). La key aparte (recuperación o extra) se
 * conserva si la había; si no, es la última. Null si no hay keys suficientes.
 */
export function convertShape(shape: PolicyShape, kind: ShapeKind): PolicyShape | null {
  const all = shapeKeys(shape);
  if (all.length < SHAPE_MIN_KEYS[kind]) return null;
  const special = shapeSpecialKey(shape) ?? all[all.length - 1]!;
  const blocks = shapeBlocks(shape) ?? DEFAULT_SHAPE_BLOCKS;
  const keys = kind === 'inheritance' || kind === 'expanding' ? all.filter((k) => k !== special) : all;
  const { min, max } = shapeThresholds(kind, keys.length);
  const k = clamp(shape.k, min, max);
  switch (kind) {
    case 'plain':
      return { kind, k, keys };
    case 'inheritance':
      return { kind, k, keys, recovery: special, blocks };
    case 'decaying':
      return { kind, k, keys, blocks };
    case 'expanding':
      return { kind, k, keys, extra: special, blocks };
  }
}

/** Otra key pasa a ser la aparte (recuperación o extra); la que lo era ocupa su sitio entre las principales. */
export function setShapeSpecialKey(shape: PolicyShape, key: Id): PolicyShape {
  if (shape.kind !== 'inheritance' && shape.kind !== 'expanding') return shape;
  const old = shape.kind === 'inheritance' ? shape.recovery : shape.extra;
  if (key === old || !shape.keys.includes(key)) return shape;
  const keys = shape.keys.map((k) => (k === key ? old : k));
  return shape.kind === 'inheritance' ? { ...shape, keys, recovery: key } : { ...shape, keys, extra: key };
}

/** Umbral, dentro de lo que admite la forma. */
export function setShapeThreshold(shape: PolicyShape, k: number): PolicyShape {
  const { min, max } = shapeThresholds(shape.kind, shape.keys.length);
  return { ...shape, k: clamp(k, min, max) };
}

/** Espera en bloques (de 1 al máximo de un timelock relativo). */
export function setShapeBlocks(shape: PolicyShape, blocks: number): PolicyShape {
  return shape.kind === 'plain' ? shape : { ...shape, blocks: clamp(blocks, 1, MAX_OLDER_BLOCKS) };
}

/** Una key nueva entra entre las principales. */
export function addShapeKey(shape: PolicyShape, key: Id): PolicyShape {
  return { ...shape, keys: [...shape.keys, key] };
}

/**
 * La forma sin `key`. Si era la aparte, queda la sencilla con las principales; si faltan keys para la forma, baja a
 * la más parecida (ampliable → herencia simple, decreciente → sencilla). Null si no queda ninguna key.
 */
export function removeShapeKey(shape: PolicyShape, key: Id): PolicyShape | null {
  if (key === shapeSpecialKey(shape)) return convertShape({ kind: 'plain', k: shape.k, keys: shape.keys }, 'plain');
  const keys = shape.keys.filter((k) => k !== key);
  if (keys.length === 0) return shape.kind === 'inheritance' ? { kind: 'plain', k: 1, keys: [shape.recovery] } : null;
  const next = { ...shape, keys } as PolicyShape;
  const { min, max } = shapeThresholds(next.kind, keys.length);
  if (min > max) return removeFallback(next);
  return { ...next, k: clamp(next.k, min, max) };
}

function removeFallback(shape: PolicyShape): PolicyShape | null {
  if (shape.kind === 'expanding') {
    return { kind: 'inheritance', k: Math.min(shape.k, shape.keys.length), keys: shape.keys, recovery: shape.extra, blocks: shape.blocks };
  }
  return convertShape(shape, 'plain');
}
