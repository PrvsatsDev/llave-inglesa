import { advisoriesFor, catalogModelByName, type Device, type Id } from '@llave-inglesa/domain';
import type { CompromisedSeed, Holdings } from './derive.ts';
import { entropyOrigins, keyCompromise, originKey, weakEntropyKeys, type EntropyOrigin } from './entropy.ts';
import { firmwareDevices, firmwareExposure } from './firmware.ts';
import { accessibleLocations, itemsAvailableAt, type World } from './world.ts';

/** Aviso de extracción física que afecta al dispositivo (con su firmware actual), o null. */
export function extractionAdvisory(device: Device): string | null {
  const catalog = catalogModelByName(device.model);
  if (!catalog) return null;
  return advisoriesFor(catalog.id, device.firmware).find((m) => m.advisory.kind === 'physical-extraction')?.advisory.id ?? null;
}

/** Acción atómica de un adversario. Un ataque real es una combinación de átomos. */
export type AttackAtom =
  /** Entrar en una ubicación sin nadie presente. */
  | { type: 'burglary'; location: Id }
  /** Llave inglesa: obligar a una persona a revelar lo que sabe y abrir una ubicación. */
  | { type: 'coercion'; person: Id; location: Id | null }
  /** Alguien de confianza actúa por su cuenta con lo que sabe y los sitios a los que accede. */
  | { type: 'insider'; person: Id }
  /** RNG defectuoso o con puerta trasera de un fabricante (o de origen desconocido). */
  | { type: 'entropy-compromise'; origin: EntropyOrigin }
  /** Fallo de entropía publicado (p. ej. Coldcard 2026): las semillas afectadas se pueden adivinar. */
  | { type: 'known-weak-entropy'; advisory: string }
  /** Firmware malicioso de un fabricante: filtra en las firmas las semillas que pasan por sus dispositivos. */
  | { type: 'malicious-firmware'; vendor: string };

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
  for (const advisory of weakEntropyKeys(model).keys()) atoms.push({ type: 'known-weak-entropy', advisory });
  for (const { vendor } of firmwareExposure(model).values()) atoms.push({ type: 'malicious-firmware', vendor });
  return atoms;
}

/**
 * Las mismas holdings, pero las personas coaccionadas dan el PIN de coacción en vez del
 * real en los dispositivos que lo tienen configurado. Quien además traiciona da el bueno.
 */
export function withDuress(world: World, atoms: readonly AttackAtom[], holdings: Holdings): Holdings {
  const traitors = new Set(atoms.flatMap((a) => (a.type === 'insider' ? [a.person] : [])));
  const coerced = [...new Set(atoms.flatMap((a) => (a.type === 'coercion' && !traitors.has(a.person) ? [a.person] : [])))];
  const devices = world.model.devices.filter((d) => d.pinProtected && d.duressPin).map((d) => d.id);
  return { ...holdings, withheldPins: coerced.flatMap((person) => devices.map((device) => ({ person, device }))) };
}

export function attackHoldings(world: World, atoms: readonly AttackAtom[]): Holdings {
  const people = new Set<Id>();
  const locations = new Set<Id>();
  const origins = new Set<string>();
  const advisories = new Set<string>();
  const firmware = new Set<string>();
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
      case 'known-weak-entropy':
        advisories.add(a.advisory);
        break;
      case 'malicious-firmware':
        firmware.add(a.vendor.trim().toLowerCase());
        break;
    }
  }
  const compromisedSeeds: CompromisedSeed[] = world.model.keys.flatMap((key) => {
    const cause = keyCompromise(key, origins);
    return cause ? [{ key: key.id, origins: cause }] : [];
  });
  for (const [advisory, keys] of weakEntropyKeys(world.model)) {
    if (advisories.has(advisory)) keys.forEach((key) => compromisedSeeds.push({ key, advisory }));
  }
  for (const [k, { vendor, keys }] of firmwareExposure(world.model)) {
    if (firmware.has(k)) keys.forEach((key) => compromisedSeeds.push({ key, firmware: vendor }));
  }
  // Extracción física: con el dispositivo en la mano, sus semillas salen aunque tenga PIN.
  // Solo en ataques: un hack de hardware no cuenta como plan de recuperación.
  for (const location of locations) {
    for (const item of itemsAvailableAt(world, location)) {
      if (item.kind !== 'device' || item.value.kind !== 'stateful') continue;
      const advisory = extractionAdvisory(item.value);
      if (advisory) item.value.holds.forEach((key) => compromisedSeeds.push({ key, advisory, device: item.value.id }));
    }
  }
  return { people: [...people], locations: [...locations], compromisedSeeds };
}

/** Cómo cae un dispositivo en un ataque: firmware malicioso del fabricante o extracción física de la semilla. */
export type DeviceCompromise = 'firmware' | 'extraction';

/** Dispositivos que el ataque compromete directamente (para señalarlos en el mapa). */
export function compromisedDevices(world: World, atoms: readonly AttackAtom[]): Map<Id, DeviceCompromise> {
  const found = new Map<Id, DeviceCompromise>();
  for (const a of atoms) {
    if (a.type === 'malicious-firmware') firmwareDevices(world.model, a.vendor).forEach((d) => found.set(d, 'firmware'));
  }
  for (const seed of attackHoldings(world, atoms).compromisedSeeds ?? []) {
    if ('device' in seed && seed.device) found.set(seed.device, 'extraction');
  }
  return found;
}
