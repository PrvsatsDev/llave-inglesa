import type { Id, Policy } from '@llave-inglesa/domain';

/**
 * Devuelve un conjunto de keys (de tamaño mínimo por rama) que satisface la política
 * con las firmas disponibles, o null si no se puede.
 */
export function satisfy(policy: Policy, available: ReadonlySet<Id>): Id[] | null {
  if (policy.type === 'key') return available.has(policy.key) ? [policy.key] : null;
  const solutions = policy.of
    .map((child) => satisfy(child, available))
    .filter((s): s is Id[] => s !== null)
    .sort((a, b) => a.length - b.length);
  return solutions.length >= policy.k ? solutions.slice(0, policy.k).flat() : null;
}
