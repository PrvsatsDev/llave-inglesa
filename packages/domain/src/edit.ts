import type { Artifact, Computer, CustodyModel, Device, EntropySource, Id, Key, Location, Person, Policy, SecretRef } from './schema.ts';
import { canLiveAt, canNest } from './validate.ts';
import { policyKeys } from './model-index.ts';
import { addShapeKey, policyShape, removeShapeKey, setShapeThreshold, shapeKeys, shapePolicy, SHAPE_MIN_KEYS, type PolicyShape } from './shape.ts';

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
  new Set([...m.keys, ...m.devices, ...m.artifacts, ...m.computers, ...m.people, ...m.locations].map((e) => e.id));

/** Id único y legible derivado de un nombre ("Casa de mis padres" → "casa-de-mis-padres"). */
export function uniqueId(model: CustodyModel, name: string): Id {
  return uniqueSlug(allIds(model), name);
}

function uniqueSlug(taken: ReadonlySet<Id>, name: string): Id {
  const slug =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
  let id = slug;
  for (let n = 2; taken.has(id); n++) id = `${slug}-${n}`;
  return id;
}

/**
 * Fabricante desconocido tal como se guarda en el modelo. Es un valor interno (los ficheros ya lo llevan así), no
 * una etiqueta: la interfaz lo muestra traducido.
 */
export const UNKNOWN_VENDOR = 'Desconocido';

// ---------- Ids ----------

/**
 * Ids que ponen las operaciones `add*` antes de que el usuario elija un nombre. No dependen del nombre que se le dé
 * (que viene en el idioma de la interfaz): son internos y `tidyIds` los cambia al exportar.
 */
const DEFAULT_ID = /^(nueva-ubicacion|nueva-persona|nuevo-dispositivo|nuevo-firmante-stateless|nuevo-backup|nuevo-ordenador)(-\d+)?$/;

/**
 * Cambia los ids por defecto (`nuevo-dispositivo-2`…) por el de su nombre actual ("Trezor de casa"
 * → `trezor-de-casa`), con todas sus referencias. Los ids puestos a mano y los de las keys no se tocan.
 * Pensado para exportar: dentro del editor los ids no se ven y cambiarlos movería la selección.
 */
export function tidyIds(model: CustodyModel): CustodyModel {
  const named = [
    ...model.locations.map((e) => ({ id: e.id, name: e.name })),
    ...model.people.map((e) => ({ id: e.id, name: e.name })),
    ...model.devices.map((e) => ({ id: e.id, name: e.label })),
    ...model.artifacts.map((e) => ({ id: e.id, name: e.label })),
    ...model.computers.map((e) => ({ id: e.id, name: e.label })),
  ].filter((e) => DEFAULT_ID.test(e.id));
  const taken = new Set([...allIds(model)].filter((id) => !named.some((e) => e.id === id)));
  const renames = new Map<Id, Id>();
  for (const e of named) {
    const id = uniqueSlug(taken, e.name);
    taken.add(id);
    if (id !== e.id) renames.set(e.id, id);
  }
  return renames.size ? renameIds(model, renames) : model;
}

/** Cambia ids de ubicaciones, personas, dispositivos, backups y ordenadores en todas sus referencias. */
export function renameIds(model: CustodyModel, renames: ReadonlyMap<Id, Id>): CustodyModel {
  const to = (id: Id) => renames.get(id) ?? id;
  const secret = (s: SecretRef): SecretRef =>
    s.type === 'pin' ? { ...s, device: to(s.device) } : s.type === 'password' ? { ...s, artifact: to(s.artifact) } : s;
  return {
    ...model,
    devices: model.devices.map((d) => ({ ...d, id: to(d.id), location: to(d.location) })),
    artifacts: model.artifacts.map((a) => ({
      ...a,
      id: to(a.id),
      location: to(a.location),
      contents: a.contents.map(secret),
      lockedBy: a.lockedBy.map(secret),
    })),
    computers: model.computers.map((c) => ({
      ...c,
      id: to(c.id),
      ...(c.location !== undefined && { location: to(c.location) }),
      ...(c.carriedBy !== undefined && { carriedBy: to(c.carriedBy) }),
      ...(c.connects && { connects: c.connects.map(to) }),
    })),
    people: model.people.map((p) => ({ ...p, id: to(p.id), knows: p.knows.map(secret), ...(p.livesAt !== undefined && { livesAt: to(p.livesAt) }) })),
    locations: model.locations.map((l) => ({
      ...l,
      id: to(l.id),
      ...(l.inside !== undefined && { inside: to(l.inside) }),
      access: l.access.map((a) => ({ person: to(a.person), when: a.when.type === 'always' ? a.when : { ...a.when, person: to(a.when.person) } })),
    })),
  };
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

/** Nombres de lo que crea un documento nuevo; los pone quien llama, en su idioma (la web, desde packages/text). */
export interface BlankNames {
  scheme: string;
  owner: string;
  home: string;
}

/** Punto de partida para un esquema propio: una key, un titular y una ubicación. */
export function blankModel(names: BlankNames = { scheme: 'Mi esquema', owner: 'Yo', home: 'Casa' }): CustodyModel {
  return {
    format: 'llave-inglesa',
    version: 1,
    name: names.scheme,
    keys: [{ id: 'k1', label: 'K1', passphrase: false, provenance: { sources: [{ kind: 'unknown' }], independentlyVerified: false } }],
    policy: { type: 'key', key: 'k1' },
    devices: [],
    artifacts: [],
    computers: [],
    people: [{ id: 'yo', name: names.owner, role: 'owner', knows: [], livesAt: 'casa' }],
    locations: [{ id: 'casa', name: names.home, kind: 'physical', access: [{ person: 'yo', when: { type: 'always' } }] }],
  };
}

// ---------- Metadatos y política ----------

export function updateMeta(model: CustodyModel, patch: { name?: string; description?: string }): CustodyModel {
  return { ...model, ...patch };
}

/** Umbral de la política (M de N), dentro de lo que admite su forma. Una política que no es una plantilla no se toca. */
export function setThreshold(model: CustodyModel, k: number): CustodyModel {
  const shape = policyShape(model.policy);
  return shape ? { ...model, policy: shapePolicy(setShapeThreshold(shape, k)) } : model;
}

/**
 * Cambia la política por la de una forma (plantilla). Debe usar cada key del modelo una sola vez, y tantas como pide
 * la forma; si no, no cambia nada.
 */
export function setPolicyShape(model: CustodyModel, shape: PolicyShape): CustodyModel {
  const keys = shapeKeys(shape);
  const known = new Set(model.keys.map((k) => k.id));
  if (keys.length < SHAPE_MIN_KEYS[shape.kind] || new Set(keys).size !== keys.length || !keys.every((k) => known.has(k))) return model;
  return { ...model, policy: shapePolicy(shape) };
}

/** Cada cuántos días mueve el titular las monedas (sin indicar: undefined). Se conserva aunque no haya timelocks. */
export function setRenewal(model: CustodyModel, everyDays: number | undefined): CustodyModel {
  const { renewal: _, ...rest } = model;
  return everyDays && everyDays > 0 ? { ...rest, renewal: { everyDays: Math.round(everyDays) } } : rest;
}

/**
 * La política sin `key`. Una rama que se queda sin ninguna key (solo un timelock) desaparece: cumplirla no exigiría
 * ninguna firma.
 */
function removeFromPolicy(p: Policy, key: Id): Policy | null {
  if (p.type === 'key') return p.key === key ? null : p;
  if (p.type === 'older') return p;
  const of = p.of.map((c) => removeFromPolicy(c, key)).filter((c): c is Policy => c !== null);
  if (policyKeys({ type: 'thresh', k: 1, of }).length === 0) return null;
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
  // Entra entre las keys principales de la plantilla. En una política escrita a mano no hay un sitio obvio: la key
  // queda fuera hasta colocarla.
  const shape = policyShape(model.policy);
  const policy = shape ? shapePolicy(addShapeKey(shape, id)) : model.policy;
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
  const shape = policyShape(model.policy);
  const reshaped = shape && removeShapeKey(shape, id);
  const policy = shape ? reshaped && shapePolicy(reshaped) : removeFromPolicy(model.policy, id);
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
  const id = uniqueId(model, 'nueva-ubicacion');
  const owners = model.people.filter((p) => p.role === 'owner');
  const location: Location = { id, name, kind, access: owners.map((p) => ({ person: p.id, when: { type: 'always' } })) };
  return { model: { ...model, locations: [...model.locations, location] }, id };
}

/** Edita nombre, tipo o accesos. Si deja de ser física, pierde su protección y se deshace el anidamiento. */
export function updateLocation(model: CustodyModel, id: Id, patch: Patch<Omit<Location, 'protection' | 'inside'>>): CustodyModel {
  const m = { ...model, locations: replace(model.locations, id, (l) => ({ ...l, ...patch })) };
  if (!patch.kind || patch.kind === 'physical') return m;
  return withValidHomes({
    ...m,
    locations: m.locations.map((l) => {
      if (l.id === id) return withoutKeys(l, 'protection', 'inside');
      return l.inside === id ? withoutKeys(l, 'inside') : l;
    }),
  });
}

/** Protección de una ubicación física (undefined = ninguna). En las demás no hace nada. */
export function setLocationProtection(model: CustodyModel, id: Id, protection: Location['protection']): CustodyModel {
  return withValidHomes({
    ...model,
    locations: model.locations.map((l) => {
      if (l.id !== id || l.kind !== 'physical') return l;
      return protection ? { ...l, protection } : withoutKeys(l, 'protection');
    }),
  });
}

/** Mete la ubicación dentro de otra (o la saca con undefined). Si no se puede anidar, no hace nada. */
export function setLocationInside(model: CustodyModel, id: Id, parent: Id | undefined): CustodyModel {
  if (parent !== undefined && !canNest(model, id, parent)) return model;
  return withValidHomes({
    ...model,
    locations: model.locations.map((l) => {
      if (l.id !== id) return l;
      return parent ? { ...l, inside: parent } : withoutKeys(l, 'inside');
    }),
  });
}

/** Quita «vive en» a quien apunta a una ubicación donde ya no se puede vivir (eliminada, en la nube, una caja…). */
function withValidHomes(model: CustodyModel): CustodyModel {
  if (!model.people.some((p) => p.livesAt !== undefined && !canLiveAt(model, p.livesAt))) return model;
  return { ...model, people: model.people.map((p) => (p.livesAt === undefined || canLiveAt(model, p.livesAt) ? p : withoutKeys(p, 'livesAt'))) };
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
    withValidHomes({
      ...model,
      // Lo que estaba dentro sigue existiendo, ahora por su cuenta.
      locations: model.locations.filter((l) => l.id !== id).map((l) => (l.inside === id ? withoutKeys(l, 'inside') : l)),
      devices: model.devices.filter((d) => d.location !== id),
      artifacts: model.artifacts.filter((a) => a.location !== id),
      // Los ordenadores que quedan (el móvil que lleva alguien) dejan de conectarse a los dispositivos que se van.
      computers: model.computers
        .filter((c) => c.location !== id)
        .map((c) => (c.connects ? { ...c, connects: c.connects.filter((d) => !goneDevices.has(d)) } : c)),
    }),
    (s) => (s.type === 'pin' && goneDevices.has(s.device)) || (s.type === 'password' && goneArtifacts.has(s.artifact)),
  );
}

// ---------- Personas ----------

export function addPerson(model: CustodyModel, name = 'Nueva persona', role: Person['role'] = 'heir'): Created {
  const id = uniqueId(model, 'nueva-persona');
  return { model: { ...model, people: [...model.people, { id, name, role, knows: [] }] }, id };
}

export function updatePerson(model: CustodyModel, id: Id, patch: Patch<Omit<Person, 'livesAt'>>): CustodyModel {
  return { ...model, people: replace(model.people, id, (p) => ({ ...p, ...patch })) };
}

/** Dónde vive (undefined = sin indicar). Si no se puede vivir en esa ubicación, no hace nada. */
export function setPersonHome(model: CustodyModel, id: Id, location: Id | undefined): CustodyModel {
  if (location !== undefined && !canLiveAt(model, location)) return model;
  return { ...model, people: replace(model.people, id, (p) => (location ? { ...p, livesAt: location } : withoutKeys(p, 'livesAt'))) };
}

/** Elimina a la persona, sus accesos, los accesos condicionados a lo que le ocurra y lo que lleva encima. */
export function removePerson(model: CustodyModel, id: Id): CustodyModel {
  const remaining = model.people.filter((p) => p.id !== id);
  if (!remaining.some((p) => p.role === 'owner')) return model;
  return {
    ...model,
    people: remaining,
    computers: model.computers.filter((c) => c.carriedBy !== id),
    locations: model.locations.map((l) => ({
      ...l,
      access: l.access.filter((a) => a.person !== id && !(a.when.type !== 'always' && a.when.person === id)),
    })),
  };
}

// ---------- Dispositivos ----------

export function addDevice(
  model: CustodyModel,
  location: Id,
  kind: Device['kind'] = 'stateful',
  name = kind === 'stateful' ? 'Nuevo dispositivo' : 'Nuevo firmante stateless',
): Created {
  const id = uniqueId(model, kind === 'stateful' ? 'nuevo-dispositivo' : 'nuevo-firmante-stateless');
  const device: Device = {
    id,
    label: name,
    vendor: UNKNOWN_VENDOR,
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
    {
      ...model,
      devices: model.devices.filter((d) => d.id !== id),
      computers: model.computers.map((c) => (c.connects ? { ...c, connects: c.connects.filter((d) => d !== id) } : c)),
    },
    (s) => s.type === 'pin' && s.device === id,
  );
}

// ---------- Backups ----------

/** `label` recibe el nombre de la key que contiene (la primera) y da el del backup. */
export function addArtifact(model: CustodyModel, location: Id, label = (key: string) => `Backup ${key}`): Created {
  const id = uniqueId(model, 'nuevo-backup');
  const first = model.keys[0]!;
  const artifact: Artifact = {
    id,
    label: label(first.label),
    medium: 'metal',
    contents: [{ type: 'seed', key: first.id }],
    lockedBy: [],
    location,
  };
  return { model: { ...model, artifacts: [...model.artifacts, artifact] }, id };
}

/**
 * Lleva un dispositivo, backup u ordenador a otra ubicación (p. ej. arrastrándolo en el mapa). Si no existe alguno, no
 * hace nada. Un ordenador que alguien llevaba encima pasa a guardarse ahí.
 */
export function moveItem(model: CustodyModel, item: { kind: 'device' | 'artifact' | 'computer'; id: Id }, location: Id): CustodyModel {
  if (!model.locations.some((l) => l.id === location)) return model;
  if (item.kind === 'computer') {
    const computer = model.computers.find((c) => c.id === item.id);
    return computer && computer.location !== location ? setComputerPlace(model, item.id, { location }) : model;
  }
  if (item.kind === 'device') {
    const device = model.devices.find((d) => d.id === item.id);
    return device && device.location !== location ? updateDevice(model, item.id, { location }) : model;
  }
  const artifact = model.artifacts.find((a) => a.id === item.id);
  return artifact && artifact.location !== location ? updateArtifact(model, item.id, { location }) : model;
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

// ---------- Ordenadores de firma ----------

/** Un ordenador nuevo en una ubicación, o un móvil que lleva encima una persona. Por defecto, de uso general y con la cartera. */
export function addComputer(model: CustodyModel, place: ComputerPlace, name = 'Nuevo ordenador'): Created {
  const id = uniqueId(model, 'nuevo-ordenador');
  const computer: Computer = { id, label: name, use: 'daily', wallet: true, ...place };
  return { model: { ...model, computers: [...model.computers, computer] }, id };
}

/** Dónde está un ordenador: guardado en una ubicación o encima de una persona. */
export type ComputerPlace = { location: Id; carriedBy?: never } | { carriedBy: Id; location?: never };

export function updateComputer(model: CustodyModel, id: Id, patch: Patch<Omit<Computer, 'location' | 'carriedBy' | 'connects'>>): CustodyModel {
  return { ...model, computers: replace(model.computers, id, (c) => ({ ...c, ...patch })) };
}

/** Qué dispositivos se le conectan por cable o Bluetooth (undefined = sin indicar: todos). Ignora los que no existen. */
export function setComputerConnects(model: CustodyModel, id: Id, connects: readonly Id[] | undefined): CustodyModel {
  const known = connects?.filter((d) => model.devices.some((x) => x.id === d));
  return { ...model, computers: replace(model.computers, id, (c) => (known ? { ...c, connects: [...new Set(known)] } : withoutKeys(c, 'connects'))) };
}

/** Lo guarda en una ubicación o se lo da a una persona (deja de estar en el otro sitio). Si no existe, no hace nada. */
export function setComputerPlace(model: CustodyModel, id: Id, place: ComputerPlace): CustodyModel {
  const exists = place.location !== undefined ? model.locations.some((l) => l.id === place.location) : model.people.some((p) => p.id === place.carriedBy);
  if (!exists) return model;
  return { ...model, computers: replace(model.computers, id, (c) => ({ ...withoutKeys(c, 'location', 'carriedBy'), ...place })) };
}

export function removeComputer(model: CustodyModel, id: Id): CustodyModel {
  return { ...model, computers: model.computers.filter((c) => c.id !== id) };
}
