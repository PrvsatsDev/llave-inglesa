import type { CustodyModel, Id } from '@llave-inglesa/domain';
import { attackAtoms, attackHoldings, withDuress, type AttackAtom } from './attacks.ts';
import { combinations, minimalCuts } from './cuts.ts';
import { derive, type Derivation, type SigningMode } from './derive.ts';
import { legitHoldings, lossAtoms } from './losses.ts';
import { attackEffort, combinedRarity, cutRarity, EXPOSURE, inheritanceBreakdown, resilienceBreakdown, securityScore, usabilityScore } from './score.ts';
import { accessibleLocations, canAct, createWorld, eventually, type LossEvent, type World } from './world.ts';

export interface AnalyzeOptions {
  /** Tamaño máximo de combinación a explorar en los cortes. */
  maxCutSize?: number;
}

export interface CutReport<A> {
  score: number;
  /** Tamaño del corte más pequeño, o null si no hay ninguno hasta `searchedUpTo`. */
  minSize: number | null;
  searchedUpTo: number;
  /** Todos los cortes mínimos encontrados, del más barato al más caro. */
  cuts: A[][];
  /** Los cortes que determinan la puntuación (los más baratos). */
  cheapest: A[][];
}

export interface SecurityReport extends CutReport<AttackAtom> {
  /** Esfuerzo del robo más barato (suma de ATTACK_EFFORT), o null si no hay. */
  minEffort: number | null;
  /** Vías de robo igual de baratas o casi (penalizan por exposición). */
  cheapRoutes: number;
  /** Esfuerzo de cada corte de `cuts` (mismo orden). */
  efforts: number[];
  /** Si cada corte exige vencer un PIN de coacción (mismo orden). */
  beatsDuress: boolean[];
}

export interface ResilienceReport {
  score: number;
  recoverableNow: boolean;
  searchedUpTo: number;
  /** Combinaciones mínimas que lo pierden todo para siempre, de la más probable a la menos. */
  cuts: LossEvent[][];
  /** Rareza de cada combinación de `cuts` (mismo orden). */
  rarities: number[];
  /** Rareza de la pérdida más probable, o null si no hay ninguna hasta `searchedUpTo`. */
  minRarity: number | null;
  /** Rareza equivalente de todas las vías juntas (sus probabilidades se suman). */
  combinedRarity: number | null;
  /** Las pérdidas más probables (las de rareza mínima). */
  cheapest: LossEvent[][];
  /**
   * Bloqueos temporales: combinaciones que impiden mover los fondos mientras
   * alguien está incapacitado, pero que se resuelven cuando fallece. Del más probable al menos.
   */
  lockouts: LossEvent[][];
  lockoutRarities: number[];
  lockoutMinRarity: number | null;
}

export interface InheritanceReport {
  score: number;
  /** 'no-heirs': tras el fallecimiento no queda nadie (ni herederos ni custodios) que pueda actuar. */
  status: 'ok' | 'no-heirs' | 'unrecoverable';
  /** Personas con papel de heredero que pueden actuar. */
  heirs: Id[];
  /** Personas de otro papel (custodios…) sin las que no se recupera; vacío si los herederos se bastan. */
  helpers: Id[];
  /** Ubicaciones mínimas a las que hay que ir, o null si no se recupera. */
  locations: Id[] | null;
  /** Viajes: las ubicaciones sin contar las que están dentro de otra de la lista. */
  visits: number | null;
  /**
   * Desgracias que, además del fallecimiento de los titulares, dejarían a los herederos sin los fondos,
   * de la más probable a la menos (vacío si no se recupera ni sin ellas).
   */
  losses: LossEvent[][];
  /** Rareza de cada combinación de `losses` (mismo orden). */
  lossRarities: number[];
  /** Rareza equivalente de todas juntas, o null si no hay ninguna hasta el límite buscado. */
  lossCombinedRarity: number | null;
}

export interface Analysis {
  /** ¿Qué combinación de ataques permite robar, y con qué esfuerzo? */
  security: SecurityReport;
  /** ¿Qué combinación de pérdidas deja los fondos inaccesibles para siempre? */
  resilience: ResilienceReport;
  /** ¿Cuántas ubicaciones tiene que visitar el titular para firmar de forma segura? */
  usability: { score: number; locations: Id[] | null; visits: number | null };
  /** Tras el fallecimiento de los titulares, ¿pueden los herederos recuperar los fondos? */
  inheritance: InheritanceReport;
}

/** ¿Qué consigue un adversario con esta combinación de ataques? */
export function simulateAttack(model: CustodyModel, atoms: readonly AttackAtom[]): Derivation {
  const world = createWorld(model);
  return derive(world, attackHoldings(world, atoms), 'any');
}

/** ¿Qué puede hacer la coalición legítima tras estas pérdidas? */
export function simulateLosses(model: CustodyModel, events: readonly LossEvent[]): Derivation {
  const world = createWorld(model, events);
  return derive(world, legitHoldings(world), 'any');
}

const activeOwners = (world: World) => world.model.people.filter((p) => p.role === 'owner' && canAct(world, p.id)).map((p) => p.id);

/** El fallecimiento de todos los titulares: el suceso del que parte la herencia. */
export function ownerDeaths(model: CustodyModel): LossEvent[] {
  return model.people.filter((p) => p.role === 'owner').map((p) => ({ type: 'death', person: p.id }));
}

/**
 * Cómo firman los titulares, de forma segura, yendo solo a `locations` (sin ubicaciones: a todas
 * las que pueden entrar). Con las de `analyze().usability.locations`, `canSpend` es cierto.
 */
export function simulateSigning(model: CustodyModel, locations?: readonly Id[]): Derivation {
  const world = createWorld(model);
  const owners = activeOwners(world);
  const reachable = locations ?? [...new Set(owners.flatMap((p) => accessibleLocations(world, p)))];
  return derive(world, { people: owners, locations: reachable }, 'secure');
}

/**
 * Qué consiguen los herederos tras fallecer los titulares yendo solo a `locations` (sin ubicaciones:
 * a todas las que pueden llegar), con `people` (sin indicar: todos los que pueden actuar).
 * Con los herederos y ayudantes del análisis, explica la puntuación de herencia.
 */
export function simulateInheritance(model: CustodyModel, locations?: readonly Id[], people?: readonly Id[]): Derivation {
  const world = createWorld(model, ownerDeaths(model));
  const legit = legitHoldings(world);
  const who = people ?? legit.people;
  const reachable = new Set(who.flatMap((p) => accessibleLocations(world, p)));
  return derive(world, { people: who, locations: (locations ?? legit.locations).filter((l) => reachable.has(l)) }, 'any');
}

/**
 * Herencia: las ubicaciones mínimas con las que la coalición legítima recupera los fondos tras el
 * fallecimiento de los titulares, y qué personas de otro papel hacen falta de verdad (se quita
 * cada una y se comprueba si los demás se bastan con las ubicaciones a las que aún llegan).
 */
function inheritanceReport(world: World, maxCutSize: number): InheritanceReport {
  const legit = legitHoldings(world);
  const role = (id: Id) => world.model.people.find((p) => p.id === id)?.role;
  const heirs = legit.people.filter((p) => role(p) === 'heir');
  const locations = legit.people.length > 0 ? minimalLocationSet(world, legit.people, legit.locations, 'any') : null;
  const status = legit.people.length === 0 ? 'no-heirs' : locations ? 'ok' : 'unrecoverable';
  let helpers = legit.people.filter((p) => role(p) !== 'heir');
  if (locations) {
    for (const p of [...helpers]) {
      const people = [...heirs, ...helpers.filter((h) => h !== p)];
      const reachable = new Set(people.flatMap((q) => accessibleLocations(world, q)));
      if (derive(world, { people, locations: locations.filter((l) => reachable.has(l)) }, 'any').canSpend) helpers = helpers.filter((h) => h !== p);
    }
  } else {
    helpers = [];
  }
  const n = visits(world, locations);

  // Fragilidad: qué más tendría que pasar, ya fallecidos los titulares, para que no lo recuperen.
  let losses: { cut: LossEvent[]; rarity: number }[] = [];
  if (locations) {
    const owners = new Set(world.model.people.filter((p) => p.role === 'owner').map((p) => p.id));
    const atoms = lossAtoms(world).filter((e) => !('person' in e && owners.has(e.person)));
    const blocked = (events: LossEvent[]) => {
      const after = createWorld(world.model, [...ownerDeaths(world.model), ...events], world.index);
      return !derive(after, legitHoldings(after), 'any').canSpend;
    };
    losses = minimalCuts(atoms, blocked, maxCutSize)
      .map((cut) => ({ cut, rarity: cutRarity(cut, world.index) }))
      .sort((a, b) => a.rarity - b.rarity || a.cut.length - b.cut.length);
  }
  const lossCombinedRarity = combinedRarity(losses.map((l) => l.rarity));
  return {
    score: inheritanceBreakdown(n, lossCombinedRarity).score,
    status, heirs, helpers, locations, visits: n,
    losses: losses.map((l) => l.cut),
    lossRarities: losses.map((l) => l.rarity),
    lossCombinedRarity,
  };
}

/** Viajes necesarios para ir a `locations`: la caja fuerte de casa se abre en la misma visita a casa. */
export function visits(world: World, locations: readonly Id[] | null): number | null {
  return locations && locations.filter((l) => world.index.locations.get(l)?.inside === undefined).length;
}

/**
 * Conjunto mínimo de ubicaciones con el que `people` puede gastar, o null si no hay. Minimiza las
 * visitas: cada una es una ubicación junto con las que tiene dentro.
 */
export function minimalLocationSet(
  world: World,
  people: readonly Id[],
  candidates: readonly Id[],
  mode: SigningMode,
): Id[] | null {
  // Se cuentan visitas: entrar en casa incluye abrir la caja fuerte que hay dentro.
  const visits = candidates.filter((l) => world.index.locations.get(l)?.inside === undefined);
  const within = (visit: Id) => [visit, ...candidates.filter((l) => world.index.locations.get(l)?.inside === visit)];
  for (let size = 0; size <= visits.length; size++) {
    for (const combo of combinations(visits.length, size)) {
      const chosen = combo.map((i) => visits[i]!);
      const locations = chosen.flatMap(within);
      if (derive(world, { people, locations }, mode).canSpend) return locations;
    }
  }
  return null;
}

/** ¿Este robo solo funciona si el coaccionado da el PIN real de un dispositivo con PIN de coacción? */
function needsDuressPin(world: World, cut: readonly AttackAtom[]): boolean {
  return duressObstacles(world, cut).length > 0;
}

/**
 * PINs de coacción que el atacante tiene que vencer para que el robo funcione: el coaccionado
 * sabe el PIN de ese dispositivo y podría dar el de coacción. Vacío si el robo no depende de ello.
 */
export function duressObstacles(world: World, cut: readonly AttackAtom[]): { person: Id; device: Id }[] {
  if (!cut.some((a) => a.type === 'coercion')) return [];
  if (!world.model.devices.some((d) => d.pinProtected && d.duressPin)) return [];
  const holdings = withDuress(world, cut, attackHoldings(world, cut));
  if (derive(world, holdings, 'any').canSpend) return [];
  const knowsPin = (person: Id, device: Id) =>
    world.model.people.some((p) => p.id === person && p.knows.some((s) => s.type === 'pin' && s.device === device));
  return (holdings.withheldPins ?? []).filter((w) => knowsPin(w.person, w.device));
}

function securityReport(world: World, found: AttackAtom[][], searchedUpTo: number): SecurityReport {
  const cuts = found
    .map((cut) => {
      const beatsDuress = needsDuressPin(world, cut);
      return { cut, beatsDuress, effort: attackEffort(cut, world.index, beatsDuress) };
    })
    .sort((a, b) => a.effort - b.effort || a.cut.length - b.cut.length);
  const minEffort = cuts[0]?.effort ?? null;
  const cheapRoutes = minEffort === null ? 0 : cuts.filter((c) => c.effort <= minEffort + EXPOSURE.margin).length;
  return {
    score: securityScore(minEffort, cheapRoutes),
    minSize: found.length ? Math.min(...found.map((c) => c.length)) : null,
    searchedUpTo,
    cuts: cuts.map((c) => c.cut),
    cheapest: cuts.filter((c) => c.effort === minEffort).map((c) => c.cut),
    minEffort,
    cheapRoutes,
    efforts: cuts.map((c) => c.effort),
    beatsDuress: cuts.map((c) => c.beatsDuress),
  };
}

export function analyze(model: CustodyModel, options: AnalyzeOptions = {}): Analysis {
  const maxCutSize = options.maxCutSize ?? 3;
  const intact = createWorld(model);

  const security = securityReport(
    intact,
    minimalCuts(attackAtoms(intact), (atoms) => derive(intact, attackHoldings(intact, atoms), 'any').canSpend, maxCutSize),
    maxCutSize,
  );

  const recoverable = (events: readonly LossEvent[]) => {
    const world = createWorld(model, events, intact.index);
    return derive(world, legitHoldings(world), 'any').canSpend;
  };
  // Permanente: ni ahora ni cuando las personas incapacitadas acaben falleciendo.
  const lostForever = (events: LossEvent[]) => !recoverable(events) && !recoverable(eventually(events));
  const blockedNow = (events: LossEvent[]) => !recoverable(events);

  const recoverableNow = recoverable([]);
  let resilience: ResilienceReport;
  if (recoverableNow) {
    const atoms = lossAtoms(intact);
    const byRarity = (cuts: LossEvent[][]) =>
      cuts.map((cut) => ({ cut, rarity: cutRarity(cut, intact.index) })).sort((a, b) => a.rarity - b.rarity || a.cut.length - b.cut.length);
    const losses = byRarity(minimalCuts(atoms, lostForever, maxCutSize));
    const lockouts = byRarity(minimalCuts(atoms, blockedNow, maxCutSize).filter((cut) => !lostForever(cut)));
    const minRarity = losses[0]?.rarity ?? null;
    const combined = combinedRarity(losses.map((l) => l.rarity));
    const lockoutMinRarity = lockouts[0]?.rarity ?? null;
    resilience = {
      score: resilienceBreakdown(minRarity, combined, lockoutMinRarity).score,
      recoverableNow,
      searchedUpTo: maxCutSize,
      cuts: losses.map((l) => l.cut),
      rarities: losses.map((l) => l.rarity),
      minRarity,
      combinedRarity: combined,
      cheapest: losses.filter((l) => l.rarity === minRarity).map((l) => l.cut),
      lockouts: lockouts.map((l) => l.cut),
      lockoutRarities: lockouts.map((l) => l.rarity),
      lockoutMinRarity,
    };
  } else {
    resilience = {
      score: 0, recoverableNow, searchedUpTo: 0, cuts: [[]], rarities: [0], minRarity: 0, combinedRarity: 0, cheapest: [[]],
      lockouts: [], lockoutRarities: [], lockoutMinRarity: null,
    };
  }

  const owners = activeOwners(intact);
  const ownerLocations = [...new Set(owners.flatMap((p) => accessibleLocations(intact, p)))];
  const usableWith = minimalLocationSet(intact, owners, ownerLocations, 'secure');
  const usableVisits = visits(intact, usableWith);

  const inheritance = inheritanceReport(createWorld(model, ownerDeaths(model), intact.index), maxCutSize);

  return {
    security,
    resilience,
    usability: { score: usabilityScore(usableVisits), locations: usableWith, visits: usableVisits },
    inheritance,
  };
}
