import type { Id } from '@llave-inglesa/domain';
import type { Holdings } from './derive.ts';
import { entropyOrigins, keyCompromise, originKey, type EntropyOrigin } from './entropy.ts';
import { accessibleLocations, type World } from './world.ts';

/** Acción atómica de un adversario. Un ataque real es una combinación de átomos. */
export type AttackAtom =
  /** Entrar en una ubicación sin nadie presente. */
  | { type: 'burglary'; location: Id }
  /** Llave inglesa: obligar a una persona a revelar lo que sabe y abrir una ubicación. */
  | { type: 'coercion'; person: Id; location: Id | null }
  /** Alguien de confianza actúa por su cuenta con lo que sabe y los sitios a los que accede. */
  | { type: 'insider'; person: Id }
  /** RNG defectuoso o con puerta trasera de un fabricante (o de origen desconocido). */
  | { type: 'entropy-compromise'; origin: EntropyOrigin };

export function attackAtoms(world: World): AttackAtom[] {
  const { model } = world;
  const atoms: AttackAtom[] = model.locations.map((l) => ({ type: 'burglary', location: l.id }));
  for (const p of model.people) {
    const locations = accessibleLocations(world, p.id);
    if (locations.length === 0) atoms.push({ type: 'coercion', person: p.id, location: null });
    for (const location of locations) atoms.push({ type: 'coercion', person: p.id, location });
  }
  for (const p of model.people) {
    if (p.role !== 'owner') atoms.push({ type: 'insider', person: p.id });
  }
  for (const origin of entropyOrigins(model)) atoms.push({ type: 'entropy-compromise', origin });
  return atoms;
}

export function attackHoldings(world: World, atoms: readonly AttackAtom[]): Holdings {
  const people = new Set<Id>();
  const locations = new Set<Id>();
  const origins = new Set<string>();
  for (const a of atoms) {
    switch (a.type) {
      case 'burglary':
        locations.add(a.location);
        break;
      case 'coercion':
        people.add(a.person);
        if (a.location) locations.add(a.location);
        break;
      case 'insider':
        people.add(a.person);
        accessibleLocations(world, a.person).forEach((l) => locations.add(l));
        break;
      case 'entropy-compromise':
        origins.add(originKey(a.origin));
        break;
    }
  }
  const compromisedSeeds = world.model.keys.flatMap((key) => {
    const cause = keyCompromise(key, origins);
    return cause ? [{ key: key.id, origins: cause }] : [];
  });
  return { people: [...people], locations: [...locations], compromisedSeeds };
}
