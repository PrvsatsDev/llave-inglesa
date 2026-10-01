import type { Id } from '@llave-inglesa/domain';
import type { Holdings } from './derive.ts';
import { accessibleLocations, canAct, DISASTERS, type LossEvent, type World } from './world.ts';

/** Eventos de pérdida candidatos para el análisis de resiliencia. */
export function lossAtoms(world: World): LossEvent[] {
  const { model } = world;
  const atoms: LossEvent[] = model.locations.flatMap((l) => DISASTERS[l.kind].map((disaster): LossEvent => ({ type: 'destroy-location', location: l.id, disaster })));
  for (const p of model.people) {
    if (p.role === 'other') continue;
    atoms.push({ type: 'death', person: p.id }, { type: 'incapacity', person: p.id });
    if (p.knows.length > 0) atoms.push({ type: 'forget', person: p.id });
  }
  for (const i of [...model.devices, ...model.artifacts]) atoms.push({ type: 'item-loss', item: i.id });
  return atoms;
}

/**
 * La coalición legítima: titulares, herederos y custodios que pueden actuar,
 * juntando lo que saben y las ubicaciones a las que pueden entrar ahora mismo.
 */
export function legitHoldings(world: World): Holdings {
  const people = world.model.people.filter((p) => p.role !== 'other' && canAct(world, p.id)).map((p) => p.id);
  const locations = new Set<Id>(people.flatMap((p) => accessibleLocations(world, p)));
  return { people, locations: [...locations] };
}
