import type { Id, Policy } from '@llave-inglesa/domain';

/** Cómo se cumple la política: las keys que firman y la espera que exige (bloques; 0 si no hay timelock por medio). */
export interface Satisfaction {
  keys: Id[];
  wait: number;
}

/** Sin moverse nunca más: todos los timelocks vencidos (quien no puede gastar tampoco puede renovar). */
export const EVENTUALLY = Number.POSITIVE_INFINITY;

/**
 * Devuelve una forma de cumplir la política con las firmas disponibles cuando las monedas llevan `elapsed` bloques
 * sin moverse, o null si no se puede. Prefiere la que menos espera y, a igual espera, la de menos keys por rama.
 */
export function satisfy(policy: Policy, available: ReadonlySet<Id>, elapsed = 0): Satisfaction | null {
  switch (policy.type) {
    case 'key':
      return available.has(policy.key) ? { keys: [policy.key], wait: 0 } : null;
    case 'older':
      return elapsed >= policy.blocks ? { keys: [], wait: policy.blocks } : null;
    case 'thresh': {
      const solutions = policy.of
        .map((child) => satisfy(child, available, elapsed))
        .filter((s): s is Satisfaction => s !== null)
        .sort((a, b) => a.wait - b.wait || a.keys.length - b.keys.length);
      if (solutions.length < policy.k) return null;
      const chosen = solutions.slice(0, policy.k);
      return { keys: [...new Set(chosen.flatMap((s) => s.keys))], wait: Math.max(...chosen.map((s) => s.wait)) };
    }
  }
}

/** Espera mínima para cumplir una rama teniendo todas las keys (null si no se puede). */
function minWait(policy: Policy): number | null {
  switch (policy.type) {
    case 'key':
      return 0;
    case 'older':
      return policy.blocks;
    case 'thresh': {
      const waits = policy.of.map(minWait).filter((w): w is number => w !== null).sort((a, b) => a - b);
      return waits.length >= policy.k ? waits[policy.k - 1]! : null;
    }
  }
}

/**
 * Cuánto hay que esperar, como poco, para que `key` sirva para gastar (teniendo las demás keys que hagan falta): 0 si
 * hay alguna forma sin esperar, la espera de su rama si solo cuenta pasado un timelock, o null si no está en la política.
 */
export function keyWait(policy: Policy, key: Id): number | null {
  switch (policy.type) {
    case 'key':
      return policy.key === key ? 0 : null;
    case 'older':
      return null;
    case 'thresh': {
      let best: number | null = null;
      policy.of.forEach((child, i) => {
        const own = keyWait(child, key);
        if (own === null) return;
        const others = policy.of
          .filter((_, j) => j !== i)
          .map(minWait)
          .filter((w): w is number => w !== null)
          .sort((a, b) => a - b);
        if (others.length < policy.k - 1) return;
        const wait = Math.max(own, ...others.slice(0, policy.k - 1));
        best = best === null ? wait : Math.min(best, wait);
      });
      return best;
    }
  }
}

/** Las keys de un grupo de firmas: `k` cualesquiera de `keys` (todas si k = keys.length). */
export interface SpendGroup {
  k: number;
  keys: Id[];
}

/** Lo que basta para gastar cuando las monedas llevan `wait` bloques sin moverse: cualquiera de los grupos. */
export interface SpendStage {
  wait: number;
  groups: SpendGroup[];
}

interface Path {
  keys: Id[];
  wait: number;
}

const subset = (a: readonly Id[], b: readonly Id[]) => a.every((k) => b.includes(k));

/** Quita los caminos repetidos y los que piden más keys y más espera que otro. */
function minimal(paths: readonly Path[]): Path[] {
  const out: Path[] = [];
  paths.forEach((p, i) => {
    const dominated = paths.some((q, j) => j !== i && q.wait <= p.wait && subset(q.keys, p.keys) && (q.wait < p.wait || q.keys.length < p.keys.length || j < i));
    if (!dominated) out.push(p);
  });
  return out;
}

class TooMany extends Error {}

function paths(policy: Policy, limit: number): Path[] {
  switch (policy.type) {
    case 'key':
      return [{ keys: [policy.key], wait: 0 }];
    case 'older':
      return [{ keys: [], wait: policy.blocks }];
    case 'thresh': {
      const children = policy.of.map((c) => paths(c, limit));
      const found: Path[] = [];
      const pick = (from: number, left: number, acc: Path) => {
        if (left === 0) {
          found.push(acc);
          if (found.length > limit) throw new TooMany();
          return;
        }
        for (let i = from; i <= children.length - left; i++) {
          for (const p of children[i]!) {
            pick(i + 1, left - 1, { keys: [...new Set([...acc.keys, ...p.keys])], wait: Math.max(acc.wait, p.wait) });
          }
        }
      };
      pick(0, policy.k, { keys: [], wait: 0 });
      return minimal(found);
    }
  }
}

const choose = (n: number, k: number): number => (k === 0 ? 1 : (choose(n - 1, k - 1) * n) / k);

/** Los conjuntos de keys como grupos: los del mismo tamaño que son todas las combinaciones de sus keys, en uno. */
function groupsOf(sets: readonly Id[][], order: readonly Id[]): SpendGroup[] {
  const sorted = (keys: Iterable<Id>) => [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const sizes = [...new Set(sets.map((s) => s.length))].sort((a, b) => b - a);
  return sizes.flatMap((k) => {
    const same = sets.filter((s) => s.length === k);
    const keys = sorted(new Set(same.flat()));
    return same.length === choose(keys.length, k) ? [{ k, keys }] : same.map((s) => ({ k, keys: sorted(s) }));
  });
}

/**
 * Las formas de gastar, por etapas: qué basta sin esperar y qué más basta según pasa el tiempo sin mover las monedas
 * (solo las etapas que cambian algo). Null si hay demasiadas combinaciones para enumerarlas (más de `limit`).
 */
export function spendStages(policy: Policy, limit = 256): SpendStage[] | null {
  let all: Path[];
  try {
    all = paths(policy, limit);
  } catch (e) {
    if (e instanceof TooMany) return null;
    throw e;
  }
  const order: Id[] = [];
  const walk = (p: Policy): void => {
    if (p.type === 'key') order.includes(p.key) || order.push(p.key);
    else if (p.type === 'thresh') p.of.forEach(walk);
  };
  walk(policy);
  const stages: SpendStage[] = [];
  let previous = '';
  for (const wait of [...new Set(all.map((p) => p.wait))].sort((a, b) => a - b)) {
    const sets = minimal(all.filter((p) => p.wait <= wait).map((p) => ({ keys: p.keys, wait: 0 }))).map((p) => p.keys);
    const groups = groupsOf(sets, order);
    const id = JSON.stringify(groups);
    if (id !== previous) stages.push({ wait, groups });
    previous = id;
  }
  return stages;
}
