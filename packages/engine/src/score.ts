import type { Id, Location, ModelIndex } from '@llave-inglesa/domain';
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
  /** Entrar sin nadie presente: sigiloso, sin confrontación. En sitios protegidos, ver BURGLARY_EFFORT. */
  burglary: 1.5,
  /** Alguien de confianza: ya tiene acceso y conocimiento, pero traicionar a la pareja es mucho más raro que un robo. */
  insider: 2.5,
  /** Llave inglesa: saber que tienes bitcoin, ir a por ti, violencia y años de cárcel. Raro, como los ataques sofisticados. */
  coercion: 3.5,
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

/** Protección de una ubicación física; sin indicar, ninguna. */
type Protection = NonNullable<Location['protection']> | 'none';

/**
 * Esfuerzo de una intrusión hasta llegar al contenido, según la protección. Si la ubicación está
 * dentro de otra, el robo exige entrar en ambas y esta solo suma la diferencia: la caja fuerte de
 * casa cuesta 1.5 (casa) + 1 (abrirla) = 2.5.
 */
export const BURGLARY_EFFORT: Readonly<Record<Protection, number>> = {
  none: ATTACK_EFFORT.burglary,
  /** Caja fuerte doméstica: hay que localizarla y forzarla o llevársela. */
  'home-safe': 2.5,
  /** Caja de seguridad de un banco: cámara acorazada, alarmas, vigilancia. */
  'bank-box': 3.5,
};

/**
 * Recargo de la llave inglesa según lo que hay que obligar a abrir. Una caja fuerte de casa se abre
 * allí mismo; para la del banco hay que llevar a la víctima en horario, identificarse y pasar cámaras.
 */
export const COERCION_SURCHARGE: Readonly<Record<Protection, number>> = {
  none: 0,
  'home-safe': 0,
  'bank-box': 1,
};

/**
 * Hackeo de una cuenta en la nube: en remoto, sin riesgo físico y contra millones de cuentas a la
 * vez (phishing, contraseñas reutilizadas, filtraciones, malware que busca semillas en las fotos).
 * Más barato que entrar en una casa.
 */
export const CLOUD_BREACH_EFFORT = 1;

const protectionOf = (index: ModelIndex, location: Id | null): Protection =>
  (location !== null && index.locations.get(location)?.protection) || 'none';

/** Esfuerzo de un ataque concreto (la ubicación decide el de intrusiones y coacciones). */
export function atomEffort(a: AttackAtom, index: ModelIndex): number {
  switch (a.type) {
    case 'passphrase-bruteforce':
      return PASSPHRASE_EFFORT[a.strength];
    case 'burglary': {
      const location = index.locations.get(a.location);
      if (location?.kind === 'cloud') return CLOUD_BREACH_EFFORT;
      // Un dispositivo no tiene protección: su intrusión es robarlo o meterle malware.
      if (location?.kind !== 'physical') return ATTACK_EFFORT.burglary;
      const own = BURGLARY_EFFORT[protectionOf(index, a.location)];
      return location.inside === undefined ? own : Math.max(0, own - BURGLARY_EFFORT[protectionOf(index, location.inside)]);
    }
    case 'coercion':
      return ATTACK_EFFORT.coercion + COERCION_SURCHARGE[protectionOf(index, a.location)];
    default:
      return ATTACK_EFFORT[a.type];
  }
}

/**
 * Recargo cuando el robo exige vencer un PIN de coacción (el coaccionado puede dar el falso).
 * No lo anula: un atacante informado puede saber que existe.
 */
export const DURESS_SURCHARGE = 1;

/**
 * Recargo por cada sitio físico más que haya que asaltar (intrusión o llave inglesa): localizar y
 * asaltar dos casas es mucho más que dos veces una. Una ubicación dentro de otra es el mismo sitio;
 * la nube, la traición o el firmware no son sitios.
 */
export const EXTRA_SITE_SURCHARGE = 1;

/** Sitios físicos distintos que exige un robo (las ubicaciones anidadas cuentan como su contenedor). */
export function attackSites(cut: readonly AttackAtom[], index: ModelIndex): Id[] {
  const sites = new Set<Id>();
  for (const a of cut) {
    if ((a.type !== 'burglary' && a.type !== 'coercion') || a.location === null) continue;
    const location = index.locations.get(a.location);
    if (location?.kind === 'physical') sites.add(location.inside ?? location.id);
  }
  return [...sites];
}

export const extraSitesSurcharge = (cut: readonly AttackAtom[], index: ModelIndex) =>
  Math.max(0, attackSites(cut, index).length - 1) * EXTRA_SITE_SURCHARGE;

export function attackEffort(cut: readonly AttackAtom[], index: ModelIndex, beatsDuress = false): number {
  return cut.reduce((sum, a) => sum + atomEffort(a, index), 0) + extraSitesSurcharge(cut, index) + (beatsDuress ? DURESS_SURCHARGE : 0);
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
  penaltyPerExtraRoute: 2,
  maxPenalty: 6,
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
  penalties: { reason: 'exposure' | 'other-routes' | 'lockout' | 'heir-fragility'; points: number }[];
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
  /** Incendio o inundación en la caja de un banco: la cámara acorazada los resiste mucho mejor que una casa. */
  'vault-disaster': 3,
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
    {
      const location = index.locations.get(e.location);
      if (e.disaster === 'total') return LOSS_RARITY.total[location?.kind ?? 'physical'];
      return location?.protection === 'bank-box' ? LOSS_RARITY['vault-disaster'] : LOSS_RARITY[e.disaster];
    }
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
  [1, 30],
  [2, 60],
  [3, 75],
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
  { below: 3, points: 5 },
  { below: 5, points: 2 },
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

/**
 * Herencia, facilidad: si los herederos pueden recuperar los fondos, y cuántas ubicaciones les cuesta.
 * Más suave que la usabilidad: firmar es recurrente, heredar ocurre una sola vez.
 */
export function inheritanceScore(locations: number | null): number {
  if (locations === null) return 0;
  return [100, 100, 95, 90][locations] ?? 80;
}

/**
 * Cuánto pesa la fragilidad del camino de los herederos: se resta este factor por lo que le falta a
 * su robustez (misma escala que la resiliencia) para llegar a 100. Con 0,4, un camino fácil pero que
 * se pierde con cualquier cosa baja como mucho a 60.
 */
export const HEIR_FRAGILITY_WEIGHT = 0.4;

/**
 * Herencia: la facilidad, menos la fragilidad. Los herederos heredan lo que quede tras toda una vida:
 * el fallecimiento es seguro, así que se da por hecho y se miden las desgracias que, además, les
 * dejarían sin los fondos (`heirLossRarity`: rareza equivalente de todas ellas).
 */
export function inheritanceBreakdown(locations: number | null, heirLossRarity: number | null): ScoreBreakdown {
  const base = inheritanceScore(locations);
  if (locations === null) return { base, penalties: [], score: base };
  const points = Math.round(HEIR_FRAGILITY_WEIGHT * (100 - rarityScore(heirLossRarity)));
  return { base, penalties: points > 0 ? [{ reason: 'heir-fragility', points }] : [], score: Math.max(0, base - points) };
}
