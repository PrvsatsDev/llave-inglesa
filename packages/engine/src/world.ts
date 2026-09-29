import { indexModel, type AccessCondition, type CustodyModel, type Id, type Item, type ModelIndex, type SecretRef } from '@llave-inglesa/domain';

/** Algo que se pierde o deja de funcionar. Nunca aumenta lo que alguien puede hacer (salvo accesos tras fallecimiento). */
export type LossEvent =
  | { type: 'destroy-location'; location: Id }
  | { type: 'item-loss'; item: Id }
  | { type: 'death'; person: Id }
  /** Vive, pero no puede actuar (y sus herederos aún no heredan). */
  | { type: 'incapacity'; person: Id }
  /** Puede actuar, pero olvida lo que tenía memorizado. */
  | { type: 'forget'; person: Id };

/** Un modelo más el estado tras aplicar eventos de pérdida. Inmutable. */
export interface World {
  readonly model: CustodyModel;
  readonly index: ModelIndex;
  readonly destroyed: ReadonlySet<Id>;
  readonly lostItems: ReadonlySet<Id>;
  readonly dead: ReadonlySet<Id>;
  readonly incapacitated: ReadonlySet<Id>;
  readonly forgetful: ReadonlySet<Id>;
}

export function createWorld(model: CustodyModel, events: readonly LossEvent[] = [], index = indexModel(model)): World {
  const world = {
    model,
    index,
    destroyed: new Set<Id>(),
    lostItems: new Set<Id>(),
    dead: new Set<Id>(),
    incapacitated: new Set<Id>(),
    forgetful: new Set<Id>(),
  };
  for (const e of events) {
    switch (e.type) {
      case 'destroy-location': world.destroyed.add(e.location); break;
      case 'item-loss': world.lostItems.add(e.item); break;
      case 'death': world.dead.add(e.person); break;
      case 'incapacity': world.incapacitated.add(e.person); break;
      case 'forget': world.forgetful.add(e.person); break;
    }
  }
  return world;
}

export function canAct(world: World, person: Id): boolean {
  return !world.dead.has(person) && !world.incapacitated.has(person);
}

/** Lo que una persona puede aportar de memoria (si puede actuar y no lo ha olvidado). */
export function knowledgeOf(world: World, person: Id): readonly SecretRef[] {
  if (!canAct(world, person) || world.forgetful.has(person)) return [];
  return world.index.people.get(person)?.knows ?? [];
}

export function conditionHolds(world: World, condition: AccessCondition): boolean {
  switch (condition.type) {
    case 'always':
      return true;
    case 'after-death':
      return world.dead.has(condition.person);
    case 'incapacity-or-death':
      return world.dead.has(condition.person) || world.incapacitated.has(condition.person);
  }
}

/** Lo que acabará pasando: una incapacidad termina, tarde o temprano, en fallecimiento. */
export function eventually(events: readonly LossEvent[]): LossEvent[] {
  return events.map((e) => (e.type === 'incapacity' ? { type: 'death', person: e.person } : e));
}

export function accessibleLocations(world: World, person: Id): Id[] {
  if (!canAct(world, person)) return [];
  return world.model.locations
    .filter((l) => !world.destroyed.has(l.id))
    .filter((l) => l.access.some((a) => a.person === person && conditionHolds(world, a.when)))
    .map((l) => l.id);
}

export function itemsAvailableAt(world: World, location: Id): readonly Item[] {
  if (world.destroyed.has(location)) return [];
  return world.index.itemsAt(location).filter((i) => !world.lostItems.has(i.value.id));
}
