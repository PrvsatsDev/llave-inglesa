import type { Artifact, Computer, CustodyModel, Device, Id, Key, Location, Person, Policy, SecretRef } from './schema.ts';

/** Un ordenador de firma que lleva una persona encima no está en ninguna ubicación. */
export type Item = { kind: 'device'; value: Device } | { kind: 'artifact'; value: Artifact } | { kind: 'computer'; value: Computer };

/** Dónde está un objeto: su ubicación o, si lo lleva encima, la persona. */
export const itemPlace = (item: Item): Id => item.value.location ?? (item.kind === 'computer' ? item.value.carriedBy : undefined) ?? '';

/** Accesos rápidos de solo lectura sobre un modelo ya validado. */
export interface ModelIndex {
  readonly keys: ReadonlyMap<Id, Key>;
  readonly devices: ReadonlyMap<Id, Device>;
  readonly artifacts: ReadonlyMap<Id, Artifact>;
  readonly computers: ReadonlyMap<Id, Computer>;
  readonly items: ReadonlyMap<Id, Item>;
  readonly people: ReadonlyMap<Id, Person>;
  readonly locations: ReadonlyMap<Id, Location>;
  /** Keys que aparecen en la política, en orden. */
  readonly policyKeys: readonly Id[];
  /** Cada cuánto renueva el titular los timelocks (del modelo). */
  readonly renewal: CustodyModel['renewal'];
  /** Objetos en esa ubicación (no los que alguien lleva encima). */
  itemsAt(location: Id): readonly Item[];
  /** Ordenadores de firma que lleva encima esa persona. */
  carriedBy(person: Id): readonly Computer[];
  /** Nombre legible de cualquier entidad. */
  label(id: Id): string;
}

/**
 * Una referencia es latente cuando lo que nombra está desactivado: el PIN de un
 * dispositivo sin PIN o la passphrase de una key sin passphrase. Se conserva, pero no cuenta.
 */
export function isActiveSecret(model: CustodyModel, s: SecretRef): boolean {
  if (s.type === 'pin') return model.devices.some((d) => d.id === s.device && d.pinProtected);
  if (s.type === 'passphrase') return model.keys.some((k) => k.id === s.key && k.passphrase);
  if (s.type === 'password') return model.artifacts.some((a) => a.lockedBy.some((l) => l.type === 'password' && l.artifact === s.artifact));
  return true;
}

/** Keys que un dispositivo guarda de verdad (un stateless conserva las suyas como latentes). */
export function activeHolds(device: Device): readonly Id[] {
  return device.kind === 'stateful' ? device.holds : [];
}

export function policyKeys(policy: Policy): Id[] {
  if (policy.type === 'key') return [policy.key];
  return policy.type === 'thresh' ? policy.of.flatMap(policyKeys) : [];
}

/** Duraciones distintas de los timelocks de la política (en bloques), de menor a mayor. */
export function policyTimelocks(policy: Policy): number[] {
  const walk = (p: Policy): number[] => (p.type === 'older' ? [p.blocks] : p.type === 'thresh' ? p.of.flatMap(walk) : []);
  return [...new Set(walk(policy))].sort((a, b) => a - b);
}

/** ¿Hay alguna rama que se cumpla sin ninguna firma (solo esperando)? Entonces cualquiera podría gastar. */
export function spendableWithoutKeys(policy: Policy): boolean {
  if (policy.type === 'key') return false;
  if (policy.type === 'older') return true;
  return policy.of.filter(spendableWithoutKeys).length >= policy.k;
}

export const normalizeLabel = (label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ');

/** Grupos de dos o más elementos con la misma clave. */
export function repeated<T>(list: readonly T[], key: (e: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const e of list) groups.set(key(e), [...(groups.get(key(e)) ?? []), e]);
  return [...groups.values()].filter((g) => g.length > 1);
}

const byId = <T extends { id: Id }>(list: readonly T[]) => new Map(list.map((e) => [e.id, e]));

export function indexModel(model: CustodyModel): ModelIndex {
  const items = new Map<Id, Item>();
  const itemsByLocation = new Map<Id, Item[]>();
  const addItem = (item: Item) => {
    items.set(item.value.id, item);
    if (item.value.location === undefined) return;
    const list = itemsByLocation.get(item.value.location) ?? [];
    list.push(item);
    itemsByLocation.set(item.value.location, list);
  };
  model.devices.forEach((value) => addItem({ kind: 'device', value }));
  model.artifacts.forEach((value) => addItem({ kind: 'artifact', value }));
  model.computers.forEach((value) => addItem({ kind: 'computer', value }));

  const labels = new Map<Id, string>();
  for (const e of [...model.keys, ...model.devices, ...model.artifacts, ...model.computers]) labels.set(e.id, e.label);
  for (const e of [...model.people, ...model.locations]) labels.set(e.id, e.name);
  // Dos objetos con la misma etiqueta no se distinguirían en las listas: se añade su ubicación
  // ("Backup K1 (Banco)") y, si también coincide, un número.
  const placeName = (id: Id) => model.locations.find((l) => l.id === id)?.name ?? model.people.find((p) => p.id === id)?.name ?? id;
  const placed = [...items.values()].map((item) => ({ id: item.value.id, label: item.value.label, place: itemPlace(item) }));
  for (const group of repeated(placed, (i) => normalizeLabel(i.label))) {
    for (const same of repeated(group, (i) => i.place)) {
      same.forEach((i, n) => labels.set(i.id, `${i.label} (${placeName(i.place)}, ${n + 1})`));
    }
    for (const i of group) if (labels.get(i.id) === i.label) labels.set(i.id, `${i.label} (${placeName(i.place)})`);
  }

  return {
    keys: byId(model.keys),
    devices: byId(model.devices),
    artifacts: byId(model.artifacts),
    computers: byId(model.computers),
    items,
    people: byId(model.people),
    locations: byId(model.locations),
    policyKeys: policyKeys(model.policy),
    renewal: model.renewal,
    itemsAt: (location) => itemsByLocation.get(location) ?? [],
    carriedBy: (person) => model.computers.filter((c) => c.carriedBy === person),
    label: (id) => labels.get(id) ?? id,
  };
}
