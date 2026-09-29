import type { Derivation } from './derive.ts';
import type { DerivedFact, FactId } from './facts.ts';

export interface ExplanationNode extends DerivedFact {
  id: FactId;
  children: ExplanationNode[];
  /** Ya explicado antes en el mismo árbol (para no repetir ramas). */
  repeated: boolean;
}

/** Árbol de "por qué" de un hecho derivado, o null si no se derivó. */
export function explain(derivation: Derivation, id: FactId): ExplanationNode | null {
  const seen = new Set<FactId>();
  const build = (factId: FactId): ExplanationNode | null => {
    const entry = derivation.facts.get(factId);
    if (!entry) return null;
    if (seen.has(factId)) return { ...entry, id: factId, children: [], repeated: true };
    seen.add(factId);
    const children = entry.justification.premises
      .map(build)
      .filter((n): n is ExplanationNode => n !== null);
    return { ...entry, id: factId, children, repeated: false };
  };
  return build(id);
}
