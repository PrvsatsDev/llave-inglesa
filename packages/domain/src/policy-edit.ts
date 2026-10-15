import { addKeyOutsidePolicy } from './edit.ts';
import { spendableWithoutKeys } from './model-index.ts';
import { BLOCKS_PER_DAY, MAX_OLDER_BLOCKS, type CustodyModel, type Id, type Policy } from './schema.ts';

/**
 * Edición libre del árbol de la política (lo que no cabe en las plantillas). Un nodo se señala por su camino: los
 * índices de los hijos desde la raíz (`[]` es la raíz, `[1, 0]` el primer hijo del segundo).
 *
 * La raíz se edita siempre como un grupo («hacen falta k de…»): una key sola es «1 de: K1». Al guardar, un grupo raíz
 * de un solo hijo con k = 1 pasa a ser ese hijo. Los grupos de dentro pueden quedarse con un solo hijo mientras se
 * construyen.
 *
 * Como todas las ediciones, nunca dejan el modelo con errores: lo que dejaría gastar sin firmar o repetiría una key en
 * un grupo devuelve el modelo sin cambios (así la interfaz sabe qué no ofrecer).
 */
export type PolicyPath = readonly number[];
export type PolicyGroup = Extract<Policy, { type: 'thresh' }>;
export type PolicyChildKind = 'key' | 'older' | 'group';

/** Espera de una rama nueva: unos 6 meses. */
const NEW_WAIT = 180 * BLOCKS_PER_DAY;

/** La raíz como grupo. */
export function policyRoot(policy: Policy): PolicyGroup {
  return policy.type === 'thresh' ? policy : { type: 'thresh', k: 1, of: [policy] };
}

const fromRoot = (root: Policy): Policy => (root.type === 'thresh' && root.of.length === 1 && root.k === 1 ? root.of[0]! : root);

/** El nodo en `path` (desde la raíz como grupo), o undefined. */
export function policyNodeAt(policy: Policy, path: PolicyPath): Policy | undefined {
  let node: Policy | undefined = policyRoot(policy);
  for (const i of path) node = node?.type === 'thresh' ? node.of[i] : undefined;
  return node;
}

/**
 * Cambia el nodo en `path` con `f` (null lo quita). Un grupo que se queda sin hijos, o que al quitarle uno se podría
 * cumplir solo esperando, se quita también.
 */
function update(p: Policy, path: PolicyPath, f: (node: Policy) => Policy | null): Policy | null {
  if (path.length === 0) return f(p);
  if (p.type !== 'thresh') return p;
  const [i, ...rest] = path;
  const child = p.of[i!];
  if (!child) return p;
  const next = update(child, rest, f);
  if (next !== null) return { ...p, of: p.of.map((c, j) => (j === i ? next : c)) };
  const of = p.of.filter((_, j) => j !== i);
  const group: Policy = { type: 'thresh', k: Math.min(p.k, of.length), of };
  return of.length === 0 || (spendableWithoutKeys(group) && !spendableWithoutKeys(p)) ? null : group;
}

const repeatsInGroup = (p: Policy): boolean => {
  if (p.type !== 'thresh') return false;
  const keys = p.of.flatMap((c) => (c.type === 'key' ? [c.key] : []));
  return new Set(keys).size !== keys.length || p.of.some(repeatsInGroup);
};

function edit(model: CustodyModel, path: PolicyPath, f: (node: Policy) => Policy | null): CustodyModel {
  const root = update(policyRoot(model.policy), path, f);
  if (root === null) return model;
  const policy = fromRoot(root);
  if (spendableWithoutKeys(policy) || repeatsInGroup(policy)) return model;
  return { ...model, policy };
}

/**
 * Añade al grupo `path` una key (la primera del esquema que no esté ya en el grupo; si están todas, una nueva), una
 * espera (unos 6 meses) o un grupo con una key. La espera cuenta como una condición más: el grupo pide uno más
 * («K1» pasa a «K1 tras esperar»; «2 de A, B», a «A y B, o una de las dos tras esperar»).
 */
export function addPolicyChild(model: CustodyModel, path: PolicyPath, kind: PolicyChildKind): CustodyModel {
  const group = policyNodeAt(model.policy, path);
  if (group?.type !== 'thresh') return model;
  if (kind === 'older') return edit(model, path, () => ({ type: 'thresh', k: group.k + 1, of: [...group.of, { type: 'older', blocks: NEW_WAIT }] }));
  const siblings = new Set(group.of.flatMap((c) => (c.type === 'key' ? [c.key] : [])));
  let next = model;
  let key = model.keys.find((k) => !siblings.has(k.id))?.id;
  if (key === undefined) ({ model: next, id: key } = addKeyOutsidePolicy(model));
  const child: Policy = kind === 'key' ? { type: 'key', key } : { type: 'thresh', k: 1, of: [{ type: 'key', key }] };
  return edit(next, path, () => ({ ...group, of: [...group.of, child] }));
}

/** Quita el nodo en `path` (no la raíz, ni lo que dejaría gastar sin firmar). */
export function removePolicyNode(model: CustodyModel, path: PolicyPath): CustodyModel {
  return path.length === 0 ? model : edit(model, path, () => null);
}

/** Cuántos hijos del grupo `path` hacen falta (de 1 al número de hijos, sin poder gastar sin firmar). */
export function setPolicyGroupThreshold(model: CustodyModel, path: PolicyPath, k: number): CustodyModel {
  return edit(model, path, (g) => (g.type === 'thresh' ? { ...g, k: Math.min(Math.max(1, Math.round(k)), g.of.length) } : g));
}

/** Otra key en la hoja `path` (no una que ya esté en el mismo grupo). */
export function setPolicyKey(model: CustodyModel, path: PolicyPath, key: Id): CustodyModel {
  if (!model.keys.some((k) => k.id === key)) return model;
  return edit(model, path, (n) => (n.type === 'key' ? { type: 'key', key } : n));
}

/** Otra espera (en bloques) en la hoja `path`. */
export function setPolicyBlocks(model: CustodyModel, path: PolicyPath, blocks: number): CustodyModel {
  return edit(model, path, (n) => (n.type === 'older' ? { type: 'older', blocks: Math.min(Math.max(1, Math.round(blocks)), MAX_OLDER_BLOCKS) } : n));
}
