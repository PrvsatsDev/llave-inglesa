import type { ModelIndex } from '@llave-inglesa/domain';
import type { AttackAtom } from './attacks.ts';
import type { LossEvent } from './world.ts';

/**
 * Puntuaciones 0–100. Deliberadamente simples y explicables: cada una sale
 * de métricas objetivas que se muestran junto al número. Todos los parámetros
 * viven aquí para poder ajustarlos sin tocar el resto del motor.
 */

/**
 * Esfuerzo y riesgo que supone cada tipo de ataque para el atacante.
 * Más alto = más difícil. Un robo real suma el esfuerzo de todos sus ataques.
 */
export const ATTACK_EFFORT: Readonly<Record<Exclude<AttackAtom['type'], 'passphrase-bruteforce'>, number>> = {
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
 * Fuerza bruta a una passphrase, teniendo ya la semilla. Una débil (palabra, fecha) cae casi gratis;
 * una frase elegida por uno exige mucho cómputo y algo de suerte. Una aleatoria larga no se intenta.
 */
export const PASSPHRASE_EFFORT: Readonly<Record<'weak' | 'phrase', number>> = {
  weak: 0.5,
  phrase: 3,
};

/** Esfuerzo de un ataque concreto. */
export function atomEffort(a: AttackAtom): number {
  return a.type === 'passphrase-bruteforce' ? PASSPHRASE_EFFORT[a.strength] : ATTACK_EFFORT[a.type];
}

/**
 * Recargo cuando el robo exige vencer un PIN de coacción (el coaccionado puede dar el falso).
 * No lo anula: un atacante informado puede saber que existe.
 */
export const DURESS_SURCHARGE = 1;

export function attackEffort(cut: readonly AttackAtom[], beatsDuress = false): number {
  return cut.reduce((sum, a) => sum + atomEffort(a), 0) + (beatsDuress ? DURESS_SURCHARGE : 0);
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
  penalties: { reason: 'exposure' | 'other-routes' | 'lockout'; points: number }[];
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

/**
 * Rareza de cada desgracia: órdenes de magnitud de improbabilidad (≈ −log10 de su probabilidad).
 * Sumar rarezas equivale a multiplicar probabilidades: dos sucesos de rareza 1 a la vez son tan
 * raros como uno de rareza 2. Más alta = menos probable.
 */
export const LOSS_RARITY = {
  /** Olvidar lo memorizado (PIN, passphrase…): de lo más frecuente. */
  forget: 1,
  /** Perder, romper o tirar un objeto concreto (papel, digital, dispositivo…). */
  'item-loss': 1,
  /** Perder una placa o unas arandelas de acero: no se rompen ni se queman, pero se pueden extraviar. */
  'steel-loss': 1.5,
  fire: 2,
  flood: 2,
  death: 2,
  incapacity: 2.5,
  /** Pérdida total de una ubicación, según su tipo. */
  total: {
    /** Pérdida del acceso a un sitio físico (cierra la caja, mudanza…): muy rara. */
    physical: 3,
    /** Avería de un portátil o disco: más frecuente que un incendio. */
    device: 1.5,
    /** Pérdida de una cuenta en la nube: más frecuente que un incendio. */
    cloud: 1.5,
  },
} as const;

export function lossRarity(e: LossEvent, index: ModelIndex): number {
  switch (e.type) {
    case 'destroy-location':
      return e.disaster === 'total' ? LOSS_RARITY.total[index.locations.get(e.location)?.kind ?? 'physical'] : LOSS_RARITY[e.disaster];
    case 'item-loss': {
      const medium = index.artifacts.get(e.item)?.medium;
      return medium === 'metal' || medium === 'washers' ? LOSS_RARITY['steel-loss'] : LOSS_RARITY['item-loss'];
    }
    default:
      return LOSS_RARITY[e.type];
  }
}

/** Rareza de una combinación de desgracias a la vez: la suma. */
export const cutRarity = (cut: readonly LossEvent[], index: ModelIndex) => cut.reduce((sum, e) => sum + lossRarity(e, index), 0);

/**
 * Rareza equivalente de varias vías de pérdida: sus probabilidades se suman.
 * Tres vías de rareza 2 equivalen a una de rareza 2 − log10(3) ≈ 1,5.
 */
export function combinedRarity(rarities: readonly number[]): number | null {
  if (rarities.length === 0) return null;
  return -Math.log10(rarities.reduce((sum, r) => sum + 10 ** -r, 0));
}

/** Curva rareza → puntuación base (interpolación lineal). */
const RARITY_CURVE: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 25],
  [2, 50],
  [3, 70],
  [4, 85],
  [5, 95],
  [6, 100],
];

export const rarityScore = (rarity: number | null) => (rarity === null ? 100 : Math.round(interpolate(RARITY_CURVE, Math.max(0, rarity))));

/**
 * Resiliencia: lo improbable que es la pérdida más probable, menos lo que suman las demás vías
 * y lo fácil que sea un bloqueo temporal.
 */
export function resilienceBreakdown(minRarity: number | null, combined: number | null, lockoutMinRarity: number | null): ScoreBreakdown {
  const base = rarityScore(minRarity);
  const others = base - rarityScore(combined);
  const lockout = lockoutPenalty(lockoutMinRarity);
  const penalties: ScoreBreakdown['penalties'] = [];
  if (others > 0) penalties.push({ reason: 'other-routes', points: others });
  if (lockout > 0) penalties.push({ reason: 'lockout', points: lockout });
  return { base, penalties, score: Math.max(0, base - others - lockout) };
}

/**
 * Un bloqueo temporal no pierde los fondos, pero puede inmovilizarlos durante años
 * (p. ej. un ictus). Resta según lo probable que sea el bloqueo más probable.
 */
export const LOCKOUT_PENALTY: readonly { below: number; points: number }[] = [
  { below: 3, points: 10 },
  { below: 5, points: 5 },
];

export function lockoutPenalty(minRarity: number | null): number {
  if (minRarity === null) return 0;
  return LOCKOUT_PENALTY.find((p) => minRarity < p.below)?.points ?? 0;
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
