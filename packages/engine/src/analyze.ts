import type { CustodyModel, Id } from '@llave-inglesa/domain';
import { attackAtoms, attackHoldings, type AttackAtom } from './attacks.ts';
import { combinations, minimalCuts } from './cuts.ts';
import { derive, type Derivation, type SigningMode } from './derive.ts';
import { legitHoldings, lossAtoms } from './losses.ts';
import { cutScore, inheritanceScore, usabilityScore } from './score.ts';
import { accessibleLocations, canAct, createWorld, type LossEvent, type World } from './world.ts';

export interface AnalyzeOptions {
  /** Tamaño máximo de combinación a explorar en los cortes. */
  maxCutSize?: number;
}

export interface CutReport<A> {
  score: number;
  /** Tamaño del corte más pequeño, o null si no hay ninguno hasta `searchedUpTo`. */
  minSize: number | null;
  searchedUpTo: number;
  /** Todos los cortes mínimos encontrados, ordenados por tamaño. */
  cuts: A[][];
}

export interface Analysis {
  /** ¿Qué combinación de ataques permite robar? */
  security: CutReport<AttackAtom>;
  /** ¿Qué combinación de pérdidas deja los fondos inaccesibles para siempre? */
  resilience: CutReport<LossEvent> & { recoverableNow: boolean };
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
  return { score: cutScore(minSize), minSize, searchedUpTo, cuts };
}

export function analyze(model: CustodyModel, options: AnalyzeOptions = {}): Analysis {
  const maxCutSize = options.maxCutSize ?? 3;
  const intact = createWorld(model);

  const security = cutReport(
    minimalCuts(attackAtoms(intact), (atoms) => derive(intact, attackHoldings(intact, atoms), 'any').canSpend, maxCutSize),
    maxCutSize,
  );

  const recoverable = (world: World) => derive(world, legitHoldings(world), 'any').canSpend;
  const recoverableNow = recoverable(intact);
  const resilience = recoverableNow
    ? {
        ...cutReport(
          minimalCuts(lossAtoms(intact), (events) => !recoverable(createWorld(model, events, intact.index)), maxCutSize),
          maxCutSize,
        ),
        recoverableNow,
      }
    : { score: 0, minSize: 0, searchedUpTo: 0, cuts: [[]], recoverableNow };

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
