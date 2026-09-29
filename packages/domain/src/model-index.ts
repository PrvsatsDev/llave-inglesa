import type { Artifact, CustodyModel, Device, Id, Key, Location, Person, Policy } from './schema.ts';

export type Item = { kind: 'device'; value: Device } | { kind: 'artifact'; value: Artifact };

/** Accesos rápidos de solo lectura sobre un modelo ya validado. */
export interface ModelIndex {
  readonly keys: ReadonlyMap<Id, Key>;
  readonly devices: ReadonlyMap<Id, Device>;
  readonly artifacts: ReadonlyMap<Id, Artifact>;
  readonly items: ReadonlyMap<Id, Item>;
  readonly people: ReadonlyMap<Id, Person>;
  readonly locations: ReadonlyMap<Id, Location>;
  /** Keys que aparecen en la política, en orden. */
  readonly policyKeys: readonly Id[];
  itemsAt(location: Id): readonly Item[];
  /** Nombre legible de cualquier entidad. */
  label(id: Id): string;
}

export function policyKeys(policy: Policy): Id[] {
  return policy.type === 'key' ? [policy.key] : policy.of.flatMap(policyKeys);
}

const byId = <T extends { id: Id }>(list: readonly T[]) => new Map(list.map((e) => [e.id, e]));

export function indexModel(model: CustodyModel): ModelIndex {
  const items = new Map<Id, Item>();
  const itemsByLocation = new Map<Id, Item[]>();
  const addItem = (item: Item) => {
    items.set(item.value.id, item);
    const list = itemsByLocation.get(item.value.location) ?? [];
    list.push(item);
    itemsByLocation.set(item.value.location, list);
  };
  model.devices.forEach((value) => addItem({ kind: 'device', value }));
  model.artifacts.forEach((value) => addItem({ kind: 'artifact', value }));

  const labels = new Map<Id, string>();
  for (const e of [...model.keys, ...model.devices, ...model.artifacts]) labels.set(e.id, e.label);
  for (const e of [...model.people, ...model.locations]) labels.set(e.id, e.name);

  return {
    keys: byId(model.keys),
    devices: byId(model.devices),
    artifacts: byId(model.artifacts),
    items,
    people: byId(model.people),
    locations: byId(model.locations),
    policyKeys: policyKeys(model.policy),
    itemsAt: (location) => itemsByLocation.get(location) ?? [],
    label: (id) => labels.get(id) ?? id,
  };
}
