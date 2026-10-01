import type { AttackAtom } from './attacks.ts';

/**
 * Puntuaciones 0–100. Deliberadamente simples y explicables: cada una sale
 * de métricas objetivas que se muestran junto al número. Todos los parámetros
 * viven aquí para poder ajustarlos sin tocar el resto del motor.
 */

/**
 * Esfuerzo y riesgo que supone cada tipo de ataque para el atacante.
 * Más alto = más difícil. Un robo real suma el esfuerzo de todos sus ataques.
 */
export const ATTACK_EFFORT: Readonly<Record<AttackAtom['type'], number>> = {
  /** Entrar sin nadie presente: sigiloso, sin confrontación. */
  burglary: 1.5,
  /** Alguien de confianza: ya tiene acceso y conocimiento. */
  insider: 1.5,
  /** Llave inglesa: violento, arriesgado, exige presencia física. */
  coercion: 2,
  /** Cadena de suministro / RNG con puerta trasera: sofisticado. */
  'entropy-compromise': 3,
  /** Fallo de entropía publicado: se adivina en remoto, sin tocar nada (ya se ha explotado). */
  'known-weak-entropy': 0.5,
  /** Actualización maliciosa o fabricante comprometido, y que el usuario firme: sofisticado. */
  'malicious-firmware': 3,
};

/**
 * Recargo cuando el robo exige vencer un PIN de coacción (el coaccionado puede dar el falso).
 * No lo anula: un atacante informado puede saber que existe.
 */
export const DURESS_SURCHARGE = 1;

export function attackEffort(cut: readonly AttackAtom[], beatsDuress = false): number {
  return cut.reduce((sum, a) => sum + ATTACK_EFFORT[a.type], 0) + (beatsDuress ? DURESS_SURCHARGE : 0);
}

/** Curva esfuerzo mínimo → puntuación base (interpolación lineal). */
const EFFORT_CURVE: readonly (readonly [number, number])[] = [
  [0, 0],
  [1.5, 35],
  [2, 45],
  [3, 65],
  [4, 80],
  [5, 90],
  [6, 100],
];

/** Tener varias vías igual de baratas es peor que tener una sola. */
export const EXPOSURE = {
  /** Una vía cuenta como "igual de barata" si cuesta como mucho esto más que la más barata. */
  margin: 0.5,
  penaltyPerExtraRoute: 4,
  maxPenalty: 12,
} as const;

function interpolate(curve: readonly (readonly [number, number])[], x: number): number {
  const last = curve[curve.length - 1]!;
  if (x >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]!;
    const [x0, y0] = curve[i - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

/** Desglose de una puntuación: una base y lo que se le resta, para poder enseñar de dónde sale. */
export interface ScoreBreakdown {
  base: number;
  penalties: { reason: 'exposure' | 'lockout'; points: number }[];
  score: number;
}

/** Seguridad: esfuerzo del robo más barato, menos la exposición por vías alternativas. */
export function securityBreakdown(minEffort: number | null, cheapRoutes: number): ScoreBreakdown {
  if (minEffort === null) return { base: 100, penalties: [], score: 100 }; // ningún robo dentro del límite buscado
  const base = Math.round(interpolate(EFFORT_CURVE, minEffort));
  const penalty = Math.min(EXPOSURE.maxPenalty, EXPOSURE.penaltyPerExtraRoute * Math.max(0, cheapRoutes - 1));
  return {
    base,
    penalties: penalty > 0 ? [{ reason: 'exposure', points: penalty }] : [],
    score: Math.max(minEffort > 0 ? 5 : 0, base - penalty),
  };
}

export function securityScore(minEffort: number | null, cheapRoutes: number): number {
  return securityBreakdown(minEffort, cheapRoutes).score;
}

/** Resiliencia: cuántas desgracias hacen falta para perderlo todo, menos lo fácil que sea un bloqueo temporal. */
export function resilienceBreakdown(minSize: number | null, lockoutMinSize: number | null): ScoreBreakdown {
  const base = cutScore(minSize);
  const penalty = lockoutPenalty(lockoutMinSize);
  return { base, penalties: penalty > 0 ? [{ reason: 'lockout', points: penalty }] : [], score: Math.max(0, base - penalty) };
}

/** Resiliencia: cuántas desgracias tienen que ocurrir a la vez. */
export function cutScore(minSize: number | null): number {
  if (minSize === null) return 100; // ningún corte dentro del límite buscado
  return [0, 25, 60, 85][minSize] ?? 100;
}

/**
 * Un bloqueo temporal no pierde los fondos, pero puede inmovilizarlos durante años
 * (p. ej. un ictus). Resta algo a la resiliencia según lo fácil que sea que ocurra.
 */
export function lockoutPenalty(minSize: number | null): number {
  if (minSize === null) return 0;
  return [0, 10, 5][minSize] ?? 0;
}

/** Usabilidad: cuántas ubicaciones hay que visitar para firmar de forma segura. */
export function usabilityScore(locations: number | null): number {
  if (locations === null) return 0;
  return [100, 100, 75, 50][locations] ?? 30;
}

/** Herencia: si los herederos pueden recuperar los fondos, y cuánto les cuesta. */
export function inheritanceScore(locations: number | null): number {
  if (locations === null) return 0;
  return [100, 100, 90, 80][locations] ?? 65;
}
