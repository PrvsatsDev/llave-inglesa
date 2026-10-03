import type { Artifact, CustodyModel, Device, EntropySource, Id, Key, Location, Person, Policy, SecretRef } from './schema.ts';
import { canNest } from './validate.ts';

/**
 * Operaciones de edición: funciones puras `modelo → modelo` que mantienen la
 * integridad referencial en cascada. La UI nunca modifica el modelo por su cuenta.
 *
 * Las operaciones que dejarían el modelo imposible (quitar la última key, la última
 * ubicación…) devuelven el modelo sin cambios.
 *
 * Principio: desactivar conserva, eliminar limpia. Ver `isActiveSecret`/`activeHolds`.
 */

type Patch<T> = Partial<Omit<T, 'id'>>;
export interface Created {
  model: CustodyModel;
  id: Id;
}

const allIds = (m: CustodyModel) =>
  new Set([...m.keys, ...m.devices, ...m.artifacts, ...m.people, ...m.locations].map((e) => e.id));

/** Id único y legible derivado de un nombre ("Casa de mis padres" → "casa-de-mis-padres"). */
export function uniqueId(model: CustodyModel, name: string): Id {
  const slug =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
  const taken = allIds(model);
  let id = slug;
  for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
  return id;
}

const replace = <T extends { id: Id }>(list: T[], id: Id, fn: (e: T) => T) => list.map((e) => (e.id === id ? fn(e) : e));

/** Quita referencias a secretos en todo el modelo. Un backup que se queda vacío desaparece. */
export function stripSecrets(model: CustodyModel, remove: (s: SecretRef) => boolean): CustodyModel {
  const keep = (list: SecretRef[]) => list.filter((s) => !remove(s));
  return {
    ...model,
    people: model.people.map((p) => ({ ...p, knows: keep(p.knows) })),
    artifacts: model.artifacts
      .map((a) => ({ ...a, contents: keep(a.contents), lockedBy: keep(a.lockedBy) }))
      .filter((a) => a.contents.length > 0),
  };
}

// ---------- Documento nuevo ----------

/** Punto de partida para un esquema propio: una key, un titular y una ubicación. */
export function blankModel(): CustodyModel {
  return {
    format: 'llave-inglesa',
    version: 1,
    name: 'Mi esquema',
    keys: [{ id: 'k1', label: 'K1', passphrase: false, provenance: { sources: [{ kind: 'unknown' }], independentlyVerified: false } }],
    policy: { type: 'key', key: 'k1' },
    devices: [],
    artifacts: [],
    people: [{ id: 'yo', name: 'Yo', role: 'owner', knows: [] }],
    locations: [{ id: 'casa', name: 'Casa', kind: 'physical', access: [{ person: 'yo', when: { type: 'always' } }] }],
  };
}

// ---------- Metadatos y política ----------

export function updateMeta(model: CustodyModel, patch: { name?: string; description?: string }): CustodyModel {
  return { ...model, ...patch };
}

/** Umbral de la política de primer nivel (M de N). */
export function setThreshold(model: CustodyModel, k: number): CustodyModel {
  const p = model.policy;
  if (p.type !== 'thresh') return model;
  return { ...model, policy: { ...p, k: Math.min(Math.max(1, Math.round(k)), p.of.length) } };
}

function removeFromPolicy(p: Policy, key: Id): Policy | null {
  if (p.type === 'key') return p.key === key ? null : p;
  const of = p.of.map((c) => removeFromPolicy(c, key)).filter((c): c is Policy => c !== null);
  if (of.length === 0) return null;
  if (of.length === 1) return of[0]!;
  return { type: 'thresh', k: Math.min(p.k, of.length), of };
}

// ---------- Keys ----------

export function addKey(model: CustodyModel): Created {
  const labels = new Set(model.keys.map((k) => k.label));
  let n = model.keys.length + 1;
  while (labels.has(`K${n}`)) n++;
  const id = uniqueId(model, `k${n}`);
  const key: Key = {
    id,
    label: `K${n}`,
    passphrase: false,
    provenance: { sources: [{ kind: 'unknown' }], independentlyVerified: false },
  };
  const leaf: Policy = { type: 'key', key: id };
  const policy: Policy =
    model.policy.type === 'key'
      ? { type: 'thresh', k: 1, of: [model.policy, leaf] }
      : { ...model.policy, of: [...model.policy.of, leaf] };
  return { model: { ...model, keys: [...model.keys, key], policy }, id };
}

/** Desactivar la passphrase conserva quién la sabe o dónde está apuntada (queda latente). */
export function updateKey(model: CustodyModel, id: Id, patch: Patch<Key>): CustodyModel {
  return { ...model, keys: replace(model.keys, id, (k) => ({ ...k, ...patch })) };
}

/** Procedencia sin rellenar: tal como la deja `addKey`. */
export function isBlankProvenance(key: Key): boolean {
  const p = key.provenance;
  return !p.generatedBy && !p.independentlyVerified && p.sources.every((s) => s.kind === 'unknown');
}

/**
 * La semilla de `keyId` se generó en el dispositivo `deviceId`: copia su fabricante, modelo y
 * firmware actual (se copian, no se enlazan: el firmware que cuenta es el de cuando se generó).
 * Si la entropía estaba sin indicar, pasa a ser el RNG de ese dispositivo; un RNG de dispositivo
 * con fabricante desconocido toma el suyo.
 */
export function setKeyGeneratedOn(model: CustodyModel, keyId: Id, deviceId: Id): CustodyModel {
  const device = model.devices.find((d) => d.id === deviceId);
  if (!device) return model;
  const { vendor, model: name, firmware } = device;
  const rng: EntropySource = { kind: 'device-rng', vendor, ...(name && { model: name }) };
  return {
    ...model,
    keys: replace(model.keys, keyId, (k) => {
      const sources = k.provenance.sources.every((s) => s.kind === 'unknown')
        ? [rng]
        : k.provenance.sources.map((s) => (s.kind === 'device-rng' && isUnknownVendor(s.vendor) ? rng : s));
      return {
        ...k,
        provenance: { ...k.provenance, sources, generatedBy: { vendor, ...(name && { model: name }), ...(firmware && { firmware }) } },
      };
    }),
  };
}

const isUnknownVendor = (vendor: string) => ['', 'desconocido'].includes(vendor.trim().toLowerCase());

export function removeKey(model: CustodyModel, id: Id): CustodyModel {
  const policy = removeFromPolicy(model.policy, id);
  if (!policy || model.keys.length <= 1) return model;
  return stripSecrets(
    {
      ...model,
      keys: model.keys.filter((k) => k.id !== id),
      policy,
      devices: model.devices.map((d) => ({ ...d, holds: d.holds.filter((k) => k !== id), ...(d.loads && { loads: d.loads.filter((k) => k !== id) }) })),
    },
    (s) => (s.type === 'seed' || s.type === 'passphrase' || s.type === 'xpub') && s.key === id,
  );
}

// ---------- Ubicaciones ----------

export function addLocation(model: CustodyModel, name = 'Nueva ubicación', kind: Location['kind'] = 'physical'): Created {
  const id = uniqueId(model, name);
  const owners = model.people.filter((p) => p.role === 'owner');
  const location: Location = { id, name, kind, access: owners.map((p) => ({ person: p.id, when: { type: 'always' } })) };
  return { model: { ...model, locations: [...model.locations, location] }, id };
}

/** Edita nombre, tipo o accesos. Si deja de ser física, pierde su protección y se deshace el anidamiento. */
export function updateLocation(model: CustodyModel, id: Id, patch: Patch<Omit<Location, 'protection' | 'inside'>>): CustodyModel {
  const m = { ...model, locations: replace(model.locations, id, (l) => ({ ...l, ...patch })) };
  if (!patch.kind || patch.kind === 'physical') return m;
  return {
    ...m,
    locations: m.locations.map((l) => {
      if (l.id === id) return withoutKeys(l, 'protection', 'inside');
      return l.inside === id ? withoutKeys(l, 'inside') : l;
    }),
  };
}

/** Protección de una ubicación física (undefined = ninguna). En las demás no hace nada. */
export function setLocationProtection(model: CustodyModel, id: Id, protection: Location['protection']): CustodyModel {
  return {
    ...model,
    locations: model.locations.map((l) => {
      if (l.id !== id || l.kind !== 'physical') return l;
      return protection ? { ...l, protection } : withoutKeys(l, 'protection');
    }),
  };
}

/** Mete la ubicación dentro de otra (o la saca con undefined). Si no se puede anidar, no hace nada. */
export function setLocationInside(model: CustodyModel, id: Id, parent: Id | undefined): CustodyModel {
  if (parent !== undefined && !canNest(model, id, parent)) return model;
  return {
    ...model,
    locations: model.locations.map((l) => {
      if (l.id !== id) return l;
      return parent ? { ...l, inside: parent } : withoutKeys(l, 'inside');
    }),
  };
}

function withoutKeys<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  for (const k of keys) delete copy[k];
  return copy;
}

/** Elimina la ubicación y los objetos que contiene; las ubicaciones de dentro quedan sueltas. */
export function removeLocation(model: CustodyModel, id: Id): CustodyModel {
  if (model.locations.length <= 1) return model;
  const goneDevices = new Set(model.devices.filter((d) => d.location === id).map((d) => d.id));
  const goneArtifacts = new Set(model.artifacts.filter((a) => a.location === id).map((a) => a.id));
  return stripSecrets(
    {
      ...model,
      // Lo que estaba dentro sigue existiendo, ahora por su cuenta.
      locations: model.locations.filter((l) => l.id !== id).map((l) => (l.inside === id ? withoutKeys(l, 'inside') : l)),
      devices: model.devices.filter((d) => d.location !== id),
      artifacts: model.artifacts.filter((a) => a.location !== id),
    },
    (s) => (s.type === 'pin' && goneDevices.has(s.device)) || (s.type === 'password' && goneArtifacts.has(s.artifact)),
  );
}

// ---------- Personas ----------

export function addPerson(model: CustodyModel, name = 'Nueva persona', role: Person['role'] = 'heir'): Created {
  const id = uniqueId(model, name);
  return { model: { ...model, people: [...model.people, { id, name, role, knows: [] }] }, id };
}

export function updatePerson(model: CustodyModel, id: Id, patch: Patch<Person>): CustodyModel {
  return { ...model, people: replace(model.people, id, (p) => ({ ...p, ...patch })) };
}

/** Elimina a la persona, sus accesos y los accesos condicionados a lo que le ocurra. */
export function removePerson(model: CustodyModel, id: Id): CustodyModel {
  const remaining = model.people.filter((p) => p.id !== id);
  if (!remaining.some((p) => p.role === 'owner')) return model;
  return {
    ...model,
    people: remaining,
    locations: model.locations.map((l) => ({
      ...l,
      access: l.access.filter((a) => a.person !== id && !(a.when.type !== 'always' && a.when.person === id)),
    })),
  };
}

// ---------- Dispositivos ----------

export function addDevice(model: CustodyModel, location: Id, kind: Device['kind'] = 'stateful'): Created {
  const name = kind === 'stateful' ? 'Nuevo dispositivo' : 'Nuevo firmante stateless';
  const id = uniqueId(model, name);
  const device: Device = {
    id,
    label: name,
    vendor: 'Desconocido',
    kind,
    holds: [],
    pinProtected: kind === 'stateful',
    duressPin: false,
    acceptsExternalSeed: false,
    registeredWallet: false,
    location,
  };
  return { model: { ...model, devices: [...model.devices, device] }, id };
}

/**
 * Quitar el PIN o pasar a stateless conserva los datos (quién sabe el PIN, qué keys guardaba)
 * como latentes: el motor los ignora mientras no apliquen y reaparecen al reactivar.
 */
export function updateDevice(model: CustodyModel, id: Id, patch: Patch<Device>): CustodyModel {
  return { ...model, devices: replace(model.devices, id, (d) => ({ ...d, ...patch })) };
}

export function removeDevice(model: CustodyModel, id: Id): CustodyModel {
  return stripSecrets(
    { ...model, devices: model.devices.filter((d) => d.id !== id) },
    (s) => s.type === 'pin' && s.device === id,
  );
}

// ---------- Backups ----------

export function addArtifact(model: CustodyModel, location: Id): Created {
  const id = uniqueId(model, 'Nuevo backup');
  const first = model.keys[0]!;
  const artifact: Artifact = {
    id,
    label: `Backup ${first.label}`,
    medium: 'metal',
    contents: [{ type: 'seed', key: first.id }],
    lockedBy: [],
    location,
  };
  return { model: { ...model, artifacts: [...model.artifacts, artifact] }, id };
}

/** Un backup no puede quedarse sin contenido: esa edición se ignora. */
export function updateArtifact(model: CustodyModel, id: Id, patch: Patch<Artifact>): CustodyModel {
  if (patch.contents && patch.contents.length === 0) return model;
  return { ...model, artifacts: replace(model.artifacts, id, (a) => ({ ...a, ...patch })) };
}

/** Elimina el backup y su contraseña de donde se supiera o estuviera apuntada. */
export function removeArtifact(model: CustodyModel, id: Id): CustodyModel {
  return stripSecrets(
    { ...model, artifacts: model.artifacts.filter((a) => a.id !== id) },
    (s) => s.type === 'password' && s.artifact === id,
  );
}

/** Activa o desactiva el cifrado con contraseña propia de un backup. */
export function setArtifactPassword(model: CustodyModel, id: Id, enabled: boolean): CustodyModel {
  const own = (s: SecretRef) => s.type === 'password' && s.artifact === id;
  return {
    ...model,
    artifacts: replace(model.artifacts, id, (a) => ({
      ...a,
      lockedBy: enabled ? [...a.lockedBy.filter((s) => !own(s)), { type: 'password', artifact: id }] : a.lockedBy.filter((s) => !own(s)),
    })),
  };
}
