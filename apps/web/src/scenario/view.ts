import { parseModel, type CustodyModel, type Id } from '@llave-inglesa/domain';
import {
  accessibleLocations,
  attackHoldings,
  createWorld,
  derive,
  eventually,
  explain,
  factId,
  legitHoldings,
  type AttackAtom,
  type Derivation,
  type ExplanationNode,
  type FactId,
  type LossEvent,
} from '@llave-inglesa/engine';

/** Un escenario es una combinación de ataques o una combinación de desgracias. */
export type Scenario = { kind: 'attack'; atoms: AttackAtom[] } | { kind: 'loss'; events: LossEvent[] };

export type Outcome =
  /** El atacante puede gastar. */
  | 'stolen'
  /** El atacante no llega. */
  | 'safe'
  /** Tras las desgracias, los fondos siguen recuperables. */
  | 'recoverable'
  /** Inmovilizados mientras dure la incapacidad; se recuperan tras el fallecimiento. */
  | 'lockout'
  /** Perdidos para siempre. */
  | 'lost';

export type ItemState = 'used' | 'reached' | 'destroyed' | 'dim';
export type LocationState = 'reached' | 'destroyed' | 'dim';
export type PersonState = 'coerced' | 'attacker' | 'legit' | 'dead' | 'incapacitated' | 'forgot' | 'dim';

export interface ScenarioView {
  scenario: Scenario;
  /** 'attack': rojo, lo que obtiene el atacante. 'recovery': verde, lo que usan los legítimos. */
  tone: 'attack' | 'recovery';
  outcome: Outcome;
  derivation: Derivation;
  /** Árbol del "por qué" (null si no se llega a gastar). */
  explanation: ExplanationNode | null;
  items: ReadonlyMap<Id, ItemState>;
  locations: ReadonlyMap<Id, LocationState>;
  people: ReadonlyMap<Id, PersonState>;
  /** Aristas de acceso persona→ubicación que intervienen. */
  edges: ReadonlySet<string>;
}

export const accessEdgeId = (person: Id, location: Id) => `access:${person}:${location}`;

/** Hechos que intervienen en el resultado: la explicación del gasto, o de cada firma conseguida si no llega. */
function usedFacts(d: Derivation): Set<FactId> {
  const roots = d.canSpend ? ['spend'] : [...d.signable].map((key) => factId({ kind: 'sign', key }));
  const used = new Set<FactId>();
  const walk = (n: ExplanationNode) => {
    used.add(n.id);
    n.children.forEach(walk);
  };
  roots.forEach((r) => {
    const node = explain(d, r);
    if (node) walk(node);
  });
  return used;
}

function referencesExist(model: CustodyModel, s: Scenario): boolean {
  const ids = new Set([...model.locations, ...model.people, ...model.devices, ...model.artifacts].map((e) => e.id));
  const refs =
    s.kind === 'attack'
      ? s.atoms.flatMap((a) => (a.type === 'burglary' ? [a.location] : a.type === 'coercion' ? [a.person, ...(a.location ? [a.location] : [])] : a.type === 'insider' ? [a.person] : []))
      : s.events.map((e) => (e.type === 'destroy-location' ? e.location : e.type === 'item-loss' ? e.item : e.person));
  return refs.every((id) => ids.has(id));
}

/** Estado visual de cada elemento del mapa bajo un escenario, o null si no se puede evaluar. */
export function scenarioView(model: CustodyModel, scenario: Scenario): ScenarioView | null {
  if (!parseModel(model).ok || !referencesExist(model, scenario)) return null;
  return scenario.kind === 'attack' ? attackView(model, scenario) : lossView(model, scenario);
}

function itemStates(model: CustodyModel, d: Derivation, used: Set<FactId>, destroyed: (id: Id, location: Id) => boolean) {
  const items = new Map<Id, ItemState>();
  for (const i of [...model.devices, ...model.artifacts]) {
    const id = factId({ kind: 'item', item: i.id });
    items.set(i.id, destroyed(i.id, i.location) ? 'destroyed' : used.has(id) ? 'used' : d.facts.has(id) ? 'reached' : 'dim');
  }
  return items;
}

function attackView(model: CustodyModel, scenario: Extract<Scenario, { kind: 'attack' }>): ScenarioView {
  const world = createWorld(model);
  const holdings = attackHoldings(world, scenario.atoms);
  const derivation = derive(world, holdings, 'any');
  const used = usedFacts(derivation);

  const people = new Map<Id, PersonState>(model.people.map((p) => [p.id, 'dim']));
  const edges = new Set<string>();
  for (const a of scenario.atoms) {
    if (a.type === 'coercion') {
      people.set(a.person, 'coerced');
      if (a.location) edges.add(accessEdgeId(a.person, a.location));
    } else if (a.type === 'insider') {
      people.set(a.person, 'attacker');
      accessibleLocations(world, a.person).forEach((l) => edges.add(accessEdgeId(a.person, l)));
    }
  }
  const reached = new Set(holdings.locations);

  return {
    scenario,
    tone: 'attack',
    outcome: derivation.canSpend ? 'stolen' : 'safe',
    derivation,
    explanation: explain(derivation, 'spend'),
    items: itemStates(model, derivation, used, () => false),
    locations: new Map(model.locations.map((l) => [l.id, reached.has(l.id) ? 'reached' : 'dim'])),
    people,
    edges,
  };
}

function lossView(model: CustodyModel, scenario: Extract<Scenario, { kind: 'loss' }>): ScenarioView {
  const world = createWorld(model, scenario.events);
  const holdings = legitHoldings(world);
  const derivation = derive(world, holdings, 'any');
  const used = usedFacts(derivation);

  let outcome: Outcome = 'recoverable';
  if (!derivation.canSpend) {
    const later = createWorld(model, eventually(scenario.events));
    outcome = derive(later, legitHoldings(later), 'any').canSpend ? 'lockout' : 'lost';
  }

  const people = new Map<Id, PersonState>();
  for (const p of model.people) {
    const state: PersonState = world.dead.has(p.id)
      ? 'dead'
      : world.incapacitated.has(p.id)
        ? 'incapacitated'
        : world.forgetful.has(p.id)
          ? 'forgot'
          : holdings.people.includes(p.id)
            ? 'legit'
            : 'dim';
    people.set(p.id, state);
  }

  const edges = new Set<string>();
  for (const p of holdings.people) accessibleLocations(world, p).forEach((l) => edges.add(accessEdgeId(p, l)));
  const reachable = new Set(holdings.locations);

  return {
    scenario,
    tone: 'recovery',
    outcome,
    derivation,
    explanation: explain(derivation, 'spend'),
    items: itemStates(model, derivation, used, (id, location) => world.lostItems.has(id) || world.destroyed.has(location)),
    locations: new Map(
      model.locations.map((l) => [l.id, world.destroyed.has(l.id) ? 'destroyed' : reachable.has(l.id) ? 'reached' : 'dim']),
    ),
    people,
    edges,
  };
}
