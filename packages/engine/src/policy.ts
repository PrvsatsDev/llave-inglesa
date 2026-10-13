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
      return { keys: chosen.flatMap((s) => s.keys), wait: Math.max(...chosen.map((s) => s.wait)) };
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
