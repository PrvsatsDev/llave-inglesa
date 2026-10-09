import { uniqueId, type CustodyModel, type Id, type SecretRef } from '@llave-inglesa/domain';
import { ownerDeaths, simulateInheritance, type InheritanceReport } from './analyze.ts';
import { explain, type ExplanationNode } from './explain.ts';
import { factId, type DerivedFact, type FactId } from './facts.ts';
import { legitHoldings } from './losses.ts';
import { accessibleLocations, createWorld, type World } from './world.ts';

/** Una pieza que los herederos tienen que ir a buscar, y para qué sirve. */
export interface LetterPiece {
  item: Id;
  kind: 'device' | 'artifact';
  /** Lo que se lee de ella (frase semilla, passphrase, PIN apuntado, descriptor…). */
  provides: SecretRef[];
  /** Keys que se firman con este dispositivo. */
  signs: Id[];
  /** El dispositivo se desbloquea con su PIN (que estará en otra pieza o en la memoria de alguien). */
  needsPin: boolean;
  /** El dispositivo tiene registrada la cartera: da las xpubs de todas las keys. */
  hasWallet: boolean;
}

/** Una ubicación a la que hay que ir, con las piezas que se usan de ella (no todo lo que hay). */
export interface LetterStop {
  location: Id;
  pieces: LetterPiece[];
}

/** Dónde guardar la carta: ubicaciones a las que llega algún heredero tras el fallecimiento. */
export interface LetterStorage {
  location: Id;
  /** Los herederos solo entran tras el fallecimiento (o la incapacidad) de alguien: un buen sitio. */
  conditional: boolean;
}

/**
 * Estructura de la carta para los herederos: sale de la simulación de herencia, así que solo lleva lo que
 * necesitan y a lo que llegan. Sin texto (lo pone `packages/text`) ni secretos (solo dónde están).
 */
export interface InheritanceLetter {
  status: InheritanceReport['status'];
  owners: Id[];
  heirs: Id[];
  helpers: Id[];
  stops: LetterStop[];
  /** Secretos que se usan y alguien sabe de memoria (quién, no cuál). */
  memory: { person: Id; secret: SecretRef }[];
  /** La recuperación usa el descriptor (o las xpubs que da). */
  usesDescriptor: boolean;
  /** No se recupera, pero se recuperaría con una copia del descriptor al alcance de los herederos. */
  missingDescriptor: boolean;
  storage: LetterStorage[];
}

/** Hechos que intervienen en el gasto (o en las firmas que se consiguen, si no llega). */
function usedFacts(root: ExplanationNode | null): Map<FactId, DerivedFact> {
  const used = new Map<FactId, DerivedFact>();
  const walk = (n: ExplanationNode) => {
    used.set(n.id, n);
    n.children.forEach(walk);
  };
  if (root) walk(root);
  return used;
}

export function inheritanceLetter(model: CustodyModel, inheritance: InheritanceReport): InheritanceLetter {
  const owners = model.people.filter((p) => p.role === 'owner').map((p) => p.id);
  const world = createWorld(model, ownerDeaths(model));
  const { heirs, helpers, status } = inheritance;

  const storage = storageFor(model, world, heirs);
  const base = { status, owners, heirs, helpers, storage };

  if (status !== 'ok' || !inheritance.locations) {
    return { ...base, stops: [], memory: [], usesDescriptor: false, missingDescriptor: wouldRecoverWithDescriptor(model, storage) };
  }

  const people = [...heirs, ...helpers];
  const derivation = simulateInheritance(model, inheritance.locations, people);
  const used = usedFacts(explain(derivation, factId({ kind: 'spend' })));
  const facts = [...used.values()];

  const pieceOf = (item: Id): LetterPiece => {
    const device = model.devices.find((d) => d.id === item);
    const itemFact = factId({ kind: 'item', item });
    const provides = facts.flatMap((f) =>
      f.fact.kind === 'secret' && f.justification.rule === 'read-artifact' && f.justification.via?.item === item ? [f.fact.secret] : [],
    );
    const signs = facts.flatMap((f) => (f.fact.kind === 'sign' && f.justification.via?.device === item ? [f.fact.key] : []));
    const hasWallet = facts.some((f) => f.justification.rule === 'device-wallet' && f.justification.via?.device === item);
    const unlocked = facts.some((f) => f.fact.kind === 'unlocked' && f.fact.device === item && f.justification.premises.includes(itemFact));
    return { item, kind: device ? 'device' : 'artifact', provides, signs, needsPin: unlocked && device?.pinProtected === true, hasWallet };
  };

  const usedItems = new Set(facts.flatMap((f) => (f.fact.kind === 'item' ? [f.fact.item] : [])));
  const locationOf = (item: Id) => model.devices.find((d) => d.id === item)?.location ?? model.artifacts.find((a) => a.id === item)?.location;
  const stops = inheritance.locations
    .map((location) => ({ location, pieces: [...usedItems].filter((i) => locationOf(i) === location).map(pieceOf) }))
    .filter((s) => s.pieces.length > 0);

  const memory = facts.flatMap((f) =>
    f.fact.kind === 'secret' && f.justification.rule === 'memory' && f.justification.via?.person ? [{ person: f.justification.via.person, secret: f.fact.secret }] : [],
  );
  const usesDescriptor = facts.some((f) => f.justification.rule === 'descriptor-xpubs' || (f.fact.kind === 'secret' && f.fact.secret.type === 'descriptor'));

  return { ...base, stops, memory, usesDescriptor, missingDescriptor: false };
}

/** Ubicaciones físicas a las que llega algún heredero tras el fallecimiento; primero las que solo se abren entonces. */
function storageFor(model: CustodyModel, world: World, heirs: readonly Id[]): LetterStorage[] {
  const reachable = new Set(heirs.flatMap((h) => accessibleLocations(world, h)));
  return model.locations
    .filter((l) => l.kind === 'physical' && reachable.has(l.id))
    .map((l) => ({
      location: l.id,
      conditional: l.access.filter((a) => heirs.includes(a.person)).every((a) => a.when.type !== 'always'),
    }))
    .sort((a, b) => Number(b.conditional) - Number(a.conditional));
}

/** ¿Recuperarían los fondos con una copia del descriptor en el mejor sitio para guardar la carta? */
function wouldRecoverWithDescriptor(model: CustodyModel, storage: readonly LetterStorage[]): boolean {
  const where = storage[0]?.location;
  if (where === undefined) return false;
  const id = uniqueId(model, 'descriptor-carta');
  const withCopy: CustodyModel = {
    ...model,
    artifacts: [...model.artifacts, { id, label: 'Descriptor', medium: 'paper', contents: [{ type: 'descriptor' }], lockedBy: [], location: where }],
  };
  const world = createWorld(withCopy, ownerDeaths(withCopy));
  return simulateInheritance(withCopy, legitHoldings(world).locations).canSpend;
}
