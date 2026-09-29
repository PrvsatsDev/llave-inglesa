import type { CustodyModel, Id } from '@llave-inglesa/domain';
import { attackAtoms, attackHoldings, type AttackAtom } from './attacks.ts';
import { combinations, minimalCuts } from './cuts.ts';
import { derive, type Derivation, type SigningMode } from './derive.ts';
import { legitHoldings, lossAtoms } from './losses.ts';
import { attackEffort, cutScore, EXPOSURE, inheritanceScore, lockoutPenalty, securityScore, usabilityScore } from './score.ts';
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
}

export interface ResilienceReport extends CutReport<LossEvent> {
  recoverableNow: boolean;
  /**
   * Bloqueos temporales: combinaciones que impiden mover los fondos mientras
   * alguien está incapacitado, pero que se resuelven cuando fallece.
   */
  lockouts: LossEvent[][];
  lockoutMinSize: number | null;
}

export interface Analysis {
  /** ¿Qué combinación de ataques permite robar, y con qué esfuerzo? */
  security: SecurityReport;
  /** ¿Qué combinación de pérdidas deja los fondos inaccesibles para siempre? */
  resilience: ResilienceReport;
  /** ¿Cuántas ubicaciones tiene que visitar el titular para firmar de forma segura? */
  usability: { score: number; locations: Id[] | null };
  /** Tras el fallecimiento de los titulares, ¿pueden los herederos recuperar los fondos? */
  inheritance: { score: number; status: 'ok' | 'no-heirs' | 'unrecoverable'; heirs: Id[]; locations: Id[] | null };
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

/** Conjunto mínimo de ubicaciones con el que `people` puede gastar, o null si no hay. */
export function minimalLocationSet(
  world: World,
  people: readonly Id[],
  candidates: readonly Id[],
  mode: SigningMode,
): Id[] | null {
  for (let size = 0; size <= candidates.length; size++) {
    for (const combo of combinations(candidates.length, size)) {
      const locations = combo.map((i) => candidates[i]!);
      if (derive(world, { people, locations }, mode).canSpend) return locations;
    }
  }
  return null;
}

function cutReport<A>(cuts: A[][], searchedUpTo: number): CutReport<A> {
  const minSize = cuts[0]?.length ?? null;
  return { score: cutScore(minSize), minSize, searchedUpTo, cuts, cheapest: cuts.filter((c) => c.length === minSize) };
}

function securityReport(found: AttackAtom[][], searchedUpTo: number): SecurityReport {
  const cuts = found
    .map((cut) => ({ cut, effort: attackEffort(cut) }))
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
  };
}

export function analyze(model: CustodyModel, options: AnalyzeOptions = {}): Analysis {
  const maxCutSize = options.maxCutSize ?? 3;
  const intact = createWorld(model);

  const security = securityReport(
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
    const losses = cutReport(minimalCuts(atoms, lostForever, maxCutSize), maxCutSize);
    const lockouts = minimalCuts(atoms, blockedNow, maxCutSize).filter((cut) => !lostForever(cut));
    const lockoutMinSize = lockouts[0]?.length ?? null;
    resilience = {
      ...losses,
      score: Math.max(0, losses.score - lockoutPenalty(lockoutMinSize)),
      recoverableNow,
      lockouts,
      lockoutMinSize,
    };
  } else {
    resilience = { score: 0, minSize: 0, searchedUpTo: 0, cuts: [[]], cheapest: [[]], recoverableNow, lockouts: [], lockoutMinSize: null };
  }

  const owners = model.people.filter((p) => p.role === 'owner' && canAct(intact, p.id)).map((p) => p.id);
  const ownerLocations = [...new Set(owners.flatMap((p) => accessibleLocations(intact, p)))];
  const usableWith = minimalLocationSet(intact, owners, ownerLocations, 'secure');

  const afterDeath = createWorld(
    model,
    model.people.filter((p) => p.role === 'owner').map((p) => ({ type: 'death', person: p.id })),
    intact.index,
  );
  const heirs = legitHoldings(afterDeath);
  const heirLocations = heirs.people.length > 0 ? minimalLocationSet(afterDeath, heirs.people, heirs.locations, 'any') : null;

  return {
    security,
    resilience,
    usability: { score: usabilityScore(usableWith?.length ?? null), locations: usableWith },
    inheritance: {
      score: inheritanceScore(heirLocations?.length ?? null),
      status: heirs.people.length === 0 ? 'no-heirs' : heirLocations ? 'ok' : 'unrecoverable',
      heirs: [...heirs.people],
      locations: heirLocations,
    },
  };
}
