import { indexModel, type AccessCondition, type Artifact, type CustodyModel, type Id, type Item, type Location, type ModelIndex, type SecretRef } from '@llave-inglesa/domain';

/** Algo que se pierde o deja de funcionar. Nunca aumenta lo que alguien puede hacer (salvo accesos tras fallecimiento). */
export type LossEvent =
  /** Desastre en una ubicación: incendio o inundación destruyen lo que no los resiste; 'total', todo. */
  | { type: 'destroy-location'; location: Id; disaster: Disaster }
  | { type: 'item-loss'; item: Id }
  | { type: 'death'; person: Id }
  /** Vive, pero no puede actuar (y sus herederos aún no heredan). */
  | { type: 'incapacity'; person: Id }
  /** Puede actuar, pero olvida lo que tenía memorizado. */
  | { type: 'forget'; person: Id };

/**
 * Tipos de desastre. Ubicación física: incendio, inundación o 'total' (pérdida del acceso: cierra
 * la caja, mudanza…). Dispositivo (portátil, disco) y nube solo tienen 'total' (avería, pérdida de la cuenta).
 */
export type Disaster = 'fire' | 'flood' | 'total';

/** Desastres posibles en cada tipo de ubicación. */
export const DISASTERS: Readonly<Record<Location['kind'], readonly Disaster[]>> = {
  physical: ['fire', 'flood', 'total'],
  device: ['total'],
  cloud: ['total'],
};

/**
 * Desastres de una ubicación concreta. Lo que está dentro de otra no tiene incendio ni inundación
 * propios (le llegan los de su contenedor), pero sí puede perderse el acceso (se estropea la cerradura…).
 */
export function disastersOf(location: Location): readonly Disaster[] {
  return location.inside === undefined ? DISASTERS[location.kind] : ['total'];
}

/**
 * Soportes que resisten cada desastre parcial. El metal se asume acero (placas, arandelas).
 * Los dispositivos (electrónica) no resisten ninguno. Ante la duda ("otro"), lo peor.
 */
export const SURVIVES: Readonly<Record<Exclude<Disaster, 'total'>, readonly Artifact['medium'][]>> = {
  fire: ['metal', 'washers'],
  flood: ['metal', 'washers'],
};

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
      case 'destroy-location':
        if (e.disaster === 'total') world.destroyed.add(e.location);
        else ruin(world, e.location, e.disaster);
        break;
      case 'item-loss': world.lostItems.add(e.item); break;
      case 'death': world.dead.add(e.person); break;
      case 'incapacity': world.incapacitated.add(e.person); break;
      case 'forget': world.forgetful.add(e.person); break;
    }
  }
  return world;
}

/**
 * Un incendio o una inundación destruyen lo que hay en la ubicación, y en lo que está dentro de ella,
 * salvo los soportes que los resisten.
 */
function ruin(world: { model: CustodyModel; index: ModelIndex; lostItems: Set<Id> }, location: Id, disaster: Exclude<Disaster, 'total'>) {
  const reached = [location, ...world.model.locations.filter((l) => l.inside === location).map((l) => l.id)];
  for (const item of reached.flatMap((l) => world.index.itemsAt(l))) {
    if (item.kind === 'artifact' && SURVIVES[disaster].includes(item.value.medium)) continue;
    world.lostItems.add(item.value.id);
  }
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

/** Perdida la ubicación, o la que la contiene. */
export function isDestroyed(world: World, location: Id): boolean {
  const parent = world.index.locations.get(location)?.inside;
  return world.destroyed.has(location) || (parent !== undefined && world.destroyed.has(parent));
}

/** Ubicaciones en las que puede entrar. En una que está dentro de otra, hace falta poder entrar en ambas. */
export function accessibleLocations(world: World, person: Id): Id[] {
  if (!canAct(world, person)) return [];
  const enters = (l: Location | undefined) => !!l && l.access.some((a) => a.person === person && conditionHolds(world, a.when));
  return world.model.locations
    .filter((l) => !isDestroyed(world, l.id))
    .filter((l) => enters(l) && (l.inside === undefined || enters(world.index.locations.get(l.inside))))
    .map((l) => l.id);
}

export function itemsAvailableAt(world: World, location: Id): readonly Item[] {
  if (isDestroyed(world, location)) return [];
  return world.index.itemsAt(location).filter((i) => !world.lostItems.has(i.value.id));
}
