import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  activeHolds,
  addComputer,
  removeComputer,
  setComputerConnects,
  setComputerPlace,
  updateComputer,
  isActiveSecret,
  addArtifact,
  blankModel,
  addDevice,
  addKey,
  addLocation,
  addPerson,
  checkIntegrity,
  CustodyModelSchema,
  parseModel,
  removeArtifact,
  removeDevice,
  removeKey,
  removeLocation,
  setLocationInside,
  moveItem,
  setPersonHome,
  setLocationProtection,
  updateLocation,
  removePerson,
  setArtifactPassword,
  setKeyGeneratedOn,
  tidyIds,
  isBlankProvenance,
  setThreshold,
  uniqueId,
  updateDevice,
  updateKey,
  updatePerson,
  type CustodyModel,
} from '../src/index.ts';

const FIXTURES = ['todo-en-casa', 'distribuido-2de3', 'singlesig-passphrase'];

function fixture(name: string): CustodyModel {
  const r = parseModel(JSON.parse(readFileSync(new URL(`../../../fixtures/${name}.json`, import.meta.url), 'utf8')));
  if (!r.ok) throw new Error(name);
  return r.model;
}

const casa = fixture('todo-en-casa');
const errors = (m: CustodyModel) => [
  ...(CustodyModelSchema.safeParse(m).success ? [] : ['schema']),
  ...checkIntegrity(m).filter((i) => i.severity === 'error').map((i) => i.code),
];

describe('operaciones de edición', () => {
  it('el esquema en blanco es válido y sin avisos', () => {
    const r = parseModel(blankModel());
    expect(r.ok && r.warnings).toEqual([]);
  });

  it('uniqueId genera slugs legibles y sin colisiones', () => {
    expect(uniqueId(casa, 'Casa de mis Padres')).toBe('casa-de-mis-padres');
    expect(uniqueId(casa, 'Casa')).toBe('casa-2');
    expect(uniqueId(casa, '¡¡¡')).toBe('item');
  });

  it('añadir una key la incorpora a la política', () => {
    const { model, id } = addKey(casa);
    expect(model.keys.at(-1)).toMatchObject({ id, label: 'K4' });
    expect(model.policy).toMatchObject({ type: 'thresh', k: 2 });
    expect(model.policy.type === 'thresh' && model.policy.of).toHaveLength(4);
  });

  it('añadir una key a un single-sig lo convierte en 1 de 2', () => {
    const { model } = addKey(fixture('singlesig-passphrase'));
    expect(model.policy).toMatchObject({ type: 'thresh', k: 1 });
  });

  it('borrar una key la quita de política, dispositivos y backups (y el backup vacío desaparece)', () => {
    const m = removeKey(casa, 'k1');
    expect(m.keys.map((k) => k.id)).toEqual(['k2', 'k3']);
    expect(m.policy).toEqual({ type: 'thresh', k: 2, of: [{ type: 'key', key: 'k2' }, { type: 'key', key: 'k3' }] });
    expect(m.devices.find((d) => d.id === 'keystone')!.holds).toEqual([]);
    expect(m.artifacts.find((a) => a.id === 'metal-k1')).toBeUndefined();
    expect(errors(m)).toEqual([]);
  });

  it('borrar una key la quita de las que se cargan en un stateless; "sin indicar" sigue sin indicar', () => {
    const seedsigner = casa.devices.find((d) => d.kind === 'stateless')!;
    const withLoads = updateDevice(casa, seedsigner.id, { loads: ['k1', 'k2'] });
    expect(removeKey(withLoads, 'k1').devices.find((d) => d.id === seedsigner.id)!.loads).toEqual(['k2']);
    const unknown = updateDevice(casa, seedsigner.id, { loads: undefined });
    expect(removeKey(unknown, 'k1').devices.find((d) => d.id === seedsigner.id)!.loads).toBeUndefined();
  });

  it('no deja borrar la última key, ubicación ni titular', () => {
    const single = fixture('singlesig-passphrase');
    expect(removeKey(single, 'k1')).toBe(single);
    expect(removePerson(casa, 'yo')).toBe(casa);
    let m = casa;
    for (const l of casa.locations) m = removeLocation(m, l.id);
    expect(m.locations).toHaveLength(1);
  });

  it('borrar una ubicación elimina su contenido y los PIN de sus dispositivos', () => {
    const m = removeLocation(casa, 'casa');
    expect(m.devices).toEqual([]);
    expect(m.people.find((p) => p.id === 'yo')!.knows).toEqual([]);
  });

  it('borrar a una persona elimina sus accesos y los condicionados a su fallecimiento', () => {
    const withHeir = addPerson(casa, 'Hija');
    const m = removePerson(updatePerson(withHeir.model, 'pareja', { role: 'owner' }), 'yo');
    expect(m.locations.flatMap((l) => l.access).some((a) => a.person === 'yo' || (a.when.type === 'after-death' && a.when.person === 'yo'))).toBe(false);
  });

  it('desactivar el PIN deja latente quién lo sabe, y reactivarlo lo recupera', () => {
    const off = updateDevice(casa, 'keystone', { pinProtected: false });
    const pin = { type: 'pin', device: 'keystone' } as const;
    expect(off.people[0]!.knows).toEqual([pin]);
    expect(isActiveSecret(off, pin)).toBe(false);
    expect(isActiveSecret(updateDevice(off, 'keystone', { pinProtected: true }), pin)).toBe(true);
  });

  it('desactivar la passphrase conserva sus backups como latentes', () => {
    const m = updateKey(fixture('singlesig-passphrase'), 'k1', { passphrase: false });
    expect(m.artifacts.find((a) => a.id === 'papel-pass')).toBeDefined();
    expect(isActiveSecret(m, { type: 'passphrase', key: 'k1' })).toBe(false);
  });

  it('un dispositivo que pasa a stateless conserva sus keys como latentes', () => {
    const d = updateDevice(casa, 'keystone', { kind: 'stateless' }).devices.find((x) => x.id === 'keystone')!;
    expect(activeHolds(d)).toEqual([]);
    expect(activeHolds({ ...d, kind: 'stateful' })).toEqual(['k1']);
  });

  it('cifrar un backup con contraseña: activa la contraseña como secreto; eliminarlo la olvida', () => {
    const pwd = { type: 'password', artifact: 'desc-casa' } as const;
    let m = setArtifactPassword(casa, 'desc-casa', true);
    expect(m.artifacts.find((a) => a.id === 'desc-casa')!.lockedBy).toEqual([pwd]);
    expect(isActiveSecret(m, pwd)).toBe(true);
    m = updatePerson(m, 'yo', { knows: [...m.people[0]!.knows, pwd] });
    expect(errors(m)).toEqual([]);
    expect(isActiveSecret(setArtifactPassword(m, 'desc-casa', false), pwd)).toBe(false);
    expect(removeArtifact(m, 'desc-casa').people[0]!.knows).not.toContainEqual(pwd);
  });

  it('eliminar sí limpia: borrar el dispositivo quita su PIN de la memoria', () => {
    expect(removeDevice(casa, 'keystone').people[0]!.knows).toEqual([]);
  });

  it('el umbral se limita a 1..N', () => {
    expect(setThreshold(casa, 9).policy).toMatchObject({ k: 3 });
    expect(setThreshold(casa, 0).policy).toMatchObject({ k: 1 });
  });
});

describe('ubicaciones protegidas y anidadas', () => {
  const safe = () => {
    const created = addLocation(casa, 'Caja fuerte');
    return { id: created.id, model: setLocationProtection(setLocationInside(created.model, created.id, 'casa'), created.id, 'home-safe') };
  };

  it('la caja fuerte queda dentro de casa, con su protección', () => {
    const { id, model } = safe();
    expect(model.locations.find((l) => l.id === id)).toMatchObject({ inside: 'casa', protection: 'home-safe' });
    expect(errors(model)).toEqual([]);
  });

  it('un solo nivel, nunca dentro de sí misma ni de algo que no es físico', () => {
    const { id, model } = safe();
    expect(setLocationInside(model, 'banco', id)).toBe(model); // la caja fuerte ya está dentro de algo
    expect(setLocationInside(model, 'casa', 'banco')).toBe(model); // casa ya contiene la caja fuerte
    expect(setLocationInside(model, 'banco', 'banco')).toBe(model);
    const cloud = addLocation(model, 'Nube', 'cloud');
    expect(setLocationInside(cloud.model, 'banco', cloud.id)).toBe(cloud.model);
  });

  it('una ubicación no física no tiene protección', () => {
    const cloud = addLocation(casa, 'Nube', 'cloud');
    expect(setLocationProtection(cloud.model, cloud.id, 'bank-box').locations.find((l) => l.id === cloud.id)?.protection).toBeUndefined();
  });

  it('si deja de ser física, pierde la protección y lo que tenía dentro queda suelto', () => {
    const { id, model } = safe();
    const m = updateLocation(model, 'casa', { kind: 'device' });
    expect(m.locations.find((l) => l.id === id)?.inside).toBeUndefined();
    const own = updateLocation(model, id, { kind: 'cloud' });
    expect(own.locations.find((l) => l.id === id)).not.toHaveProperty('protection');
    expect(errors(m)).toEqual([]);
    expect(errors(own)).toEqual([]);
  });

  it('eliminar el contenedor deja la caja fuerte por su cuenta, con su protección', () => {
    const { id, model } = safe();
    const m = removeLocation(model, 'casa');
    expect(m.locations.find((l) => l.id === id)).toMatchObject({ protection: 'home-safe' });
    expect(m.locations.find((l) => l.id === id)).not.toHaveProperty('inside');
  });
});

describe('dónde vive cada persona', () => {
  const home = (m: CustodyModel, person: string) => m.people.find((p) => p.id === person)?.livesAt;

  it('vive en una ubicación física de primer nivel', () => {
    const m = setPersonHome(casa, casa.people[0]!.id, 'casa');
    expect(home(m, casa.people[0]!.id)).toBe('casa');
    expect(errors(m)).toEqual([]);
    expect(home(setPersonHome(m, casa.people[0]!.id, undefined), casa.people[0]!.id)).toBeUndefined();
  });

  it('no se vive en la nube, en una caja del banco ni dentro de otra ubicación', () => {
    const person = casa.people[0]!.id;
    const cloud = addLocation(casa, 'Nube', 'cloud');
    expect(setPersonHome(cloud.model, person, cloud.id)).toBe(cloud.model);
    expect(setPersonHome(casa, person, 'banco')).toBe(casa);
    const safe = addLocation(casa, 'Caja fuerte');
    const nested = setLocationInside(safe.model, safe.id, 'casa');
    expect(setPersonHome(nested, person, safe.id)).toBe(nested);
    expect(setPersonHome(casa, person, 'no-existe')).toBe(casa);
  });

  it('si la ubicación deja de servir para vivir o se elimina, se limpia', () => {
    const person = casa.people[0]!.id;
    const m = setPersonHome(casa, person, 'padres');
    expect(home(m, person)).toBe('padres');
    expect(home(setLocationProtection(m, 'padres', 'bank-box'), person)).toBeUndefined();
    expect(home(setLocationProtection(m, 'padres', 'home-safe'), person)).toBe('padres');
    expect(home(updateLocation(m, 'padres', { kind: 'cloud' }), person)).toBeUndefined();
    expect(home(setLocationInside(m, 'padres', 'casa'), person)).toBeUndefined();
    const gone = removeLocation(m, 'padres');
    expect(home(gone, person)).toBeUndefined();
    expect(errors(gone)).toEqual([]);
  });

  it('la integridad rechaza un «vive en» no válido', () => {
    const bad = { ...casa, people: casa.people.map((p, i) => (i === 0 ? { ...p, livesAt: 'banco' } : p)) };
    expect(errors(bad)).toContain('invalid-home');
    expect(errors({ ...bad, people: bad.people.map((p, i) => (i === 0 ? { ...p, livesAt: 'no-existe' } : p)) })).toContain('unknown-reference');
  });

  it('el documento nuevo: el titular vive en casa', () => {
    const m = blankModel();
    expect(m.people[0]!.livesAt).toBe('casa');
    expect(errors(m)).toEqual([]);
  });
});

describe('mover objetos entre ubicaciones', () => {
  it('un backup o un dispositivo cambian de ubicación', () => {
    const m = moveItem(moveItem(casa, { kind: 'artifact', id: 'arandelas-k3' }, 'banco'), { kind: 'device', id: 'keystone' }, 'padres');
    expect(m.artifacts.find((a) => a.id === 'arandelas-k3')!.location).toBe('banco');
    expect(m.devices.find((d) => d.id === 'keystone')!.location).toBe('padres');
    expect(errors(m)).toEqual([]);
  });

  it('a su misma ubicación, a una que no existe o algo que no existe: nada', () => {
    expect(moveItem(casa, { kind: 'artifact', id: 'arandelas-k3' }, 'padres')).toBe(casa);
    expect(moveItem(casa, { kind: 'artifact', id: 'arandelas-k3' }, 'no-existe')).toBe(casa);
    expect(moveItem(casa, { kind: 'device', id: 'no-existe' }, 'banco')).toBe(casa);
  });
});

/** Operación aleatoria sobre ids que existen en el modelo actual. */
type Op = (m: CustodyModel, pick: (n: number) => number) => CustodyModel;
const ops: Op[] = [
  (m) => addKey(m).model,
  (m, pick) => removeKey(m, m.keys[pick(m.keys.length)]!.id),
  (m, pick) => updateKey(m, m.keys[pick(m.keys.length)]!.id, { passphrase: pick(2) === 0 }),
  (m, pick) => setThreshold(m, pick(5)),
  (m) => addLocation(m).model,
  (m, pick) => removeLocation(m, m.locations[pick(m.locations.length)]!.id),
  (m) => addPerson(m).model,
  (m, pick) => removePerson(m, m.people[pick(m.people.length)]!.id),
  (m, pick) => addDevice(m, m.locations[pick(m.locations.length)]!.id, pick(2) ? 'stateful' : 'stateless').model,
  (m, pick) => (m.devices.length ? removeDevice(m, m.devices[pick(m.devices.length)]!.id) : m),
  (m, pick) => {
    if (!m.devices.length) return m;
    const d = m.devices[pick(m.devices.length)]!;
    return updateDevice(m, d.id, { pinProtected: pick(2) === 0, kind: pick(2) ? 'stateful' : 'stateless', holds: [m.keys[pick(m.keys.length)]!.id] });
  },
  (m, pick) => addArtifact(m, m.locations[pick(m.locations.length)]!.id).model,
  (m, pick) => (m.artifacts.length ? removeArtifact(m, m.artifacts[pick(m.artifacts.length)]!.id) : m),
  (m, pick) => setLocationProtection(m, m.locations[pick(m.locations.length)]!.id, ([undefined, 'home-safe', 'bank-box'] as const)[pick(3)]),
  (m, pick) => setLocationInside(m, m.locations[pick(m.locations.length)]!.id, pick(4) ? m.locations[pick(m.locations.length)]!.id : undefined),
  (m, pick) => updateLocation(m, m.locations[pick(m.locations.length)]!.id, { kind: (['physical', 'device', 'cloud'] as const)[pick(3)] }),
  (m, pick) => {
    const items = [
      ...m.devices.map((d) => ({ kind: 'device' as const, id: d.id })),
      ...m.artifacts.map((a) => ({ kind: 'artifact' as const, id: a.id })),
      ...m.computers.map((c) => ({ kind: 'computer' as const, id: c.id })),
    ];
    return items.length ? moveItem(m, items[pick(items.length)]!, m.locations[pick(m.locations.length)]!.id) : m;
  },
  (m, pick) => setPersonHome(m, m.people[pick(m.people.length)]!.id, pick(4) ? m.locations[pick(m.locations.length)]!.id : undefined),
  (m, pick) =>
    addComputer(m, pick(2) ? { location: m.locations[pick(m.locations.length)]!.id } : { carriedBy: m.people[pick(m.people.length)]!.id }).model,
  (m, pick) => (m.computers.length ? removeComputer(m, m.computers[pick(m.computers.length)]!.id) : m),
  (m, pick) => (m.computers.length ? updateComputer(m, m.computers[pick(m.computers.length)]!.id, { use: pick(2) ? 'daily' : 'dedicated', wallet: pick(2) === 0 }) : m),
  (m, pick) => {
    if (!m.computers.length) return m;
    const id = m.computers[pick(m.computers.length)]!.id;
    return setComputerPlace(m, id, pick(2) ? { location: m.locations[pick(m.locations.length)]!.id } : { carriedBy: m.people[pick(m.people.length)]!.id });
  },
  (m, pick) => {
    if (!m.computers.length) return m;
    const ids = m.devices.filter(() => pick(2) === 0).map((d) => d.id);
    return setComputerConnects(m, m.computers[pick(m.computers.length)]!.id, pick(3) ? ids : undefined);
  },
  (m, pick) => (m.devices.length ? setKeyGeneratedOn(m, m.keys[pick(m.keys.length)]!.id, m.devices[pick(m.devices.length)]!.id) : m),
];

describe('ordenador de firma', () => {
  it('en una ubicación o encima de una persona; cambiar de sitio deja el otro', () => {
    const { model, id } = addComputer(casa, { location: 'casa' });
    expect(model.computers.at(-1)).toEqual({ id: 'nuevo-ordenador', label: 'Nuevo ordenador', use: 'daily', wallet: true, location: 'casa' });
    const carried = setComputerPlace(model, id, { carriedBy: 'yo' });
    expect(carried.computers.at(-1)).toEqual({ id, label: 'Nuevo ordenador', use: 'daily', wallet: true, carriedBy: 'yo' });
    expect(errors(carried)).toEqual([]);
    expect(moveItem(carried, { kind: 'computer', id }, 'padres').computers.at(-1)).toMatchObject({ location: 'padres' });
    expect(moveItem(carried, { kind: 'computer', id }, 'padres').computers.at(-1)!.carriedBy).toBeUndefined();
    expect(setComputerPlace(model, id, { carriedBy: 'nadie' })).toBe(model);
  });

  it('eliminar a la persona se lleva su móvil; eliminar la ubicación, el ordenador', () => {
    const a = addComputer(casa, { carriedBy: 'yo' });
    const b = addComputer(a.model, { location: 'padres' });
    const withHeir = addPerson(b.model);
    const phone = setComputerPlace(withHeir.model, a.id, { carriedBy: withHeir.id });
    expect(removePerson(phone, withHeir.id).computers.map((c) => c.id)).toEqual([b.id]);
    expect(removeLocation(phone, 'padres').computers.map((c) => c.id)).toEqual([a.id]);
  });

  it('sin sitio o con dos no es válido', () => {
    const { model } = addComputer(casa, { location: 'casa' });
    const both = { ...model, computers: model.computers.map((c) => ({ ...c, carriedBy: 'yo' })) };
    expect(errors(both)).toEqual(['invalid-computer-place']);
    const none = { ...model, computers: model.computers.map(({ location: _, ...c }) => c) };
    expect(errors(none)).toEqual(['invalid-computer-place']);
  });

  it('qué dispositivos se le conectan: sin indicar, o una lista que se limpia al eliminar uno', () => {
    const { model, id } = addComputer(casa, { location: 'casa' });
    const some = setComputerConnects(model, id, ['keystone', 'no-existe', 'keystone']);
    expect(some.computers.at(-1)!.connects).toEqual(['keystone']);
    expect(removeDevice(some, 'keystone').computers.at(-1)!.connects).toEqual([]);
    expect(setComputerConnects(some, id, undefined).computers.at(-1)!.connects).toBeUndefined();
    expect(errors(removeDevice(some, 'keystone'))).toEqual([]);
  });

  it('al exportar, su id sale del nombre, también en quien lo lleva', () => {
    const p = addPerson(casa, 'Ana');
    const c = addComputer(p.model, { carriedBy: p.id }, 'Móvil de Ana');
    const m = tidyIds(c.model);
    expect(m.computers.at(-1)).toMatchObject({ id: 'movil-de-ana', carriedBy: 'ana' });
    expect(errors(m)).toEqual([]);
  });
});

describe('procedencia generada en un dispositivo', () => {
  it('una key nueva rellena su procedencia desde el dispositivo: RNG y generación', () => {
    const { model, id } = addKey(casa);
    expect(isBlankProvenance(model.keys.find((k) => k.id === id)!)).toBe(true);
    const key = setKeyGeneratedOn(model, id, 'keystone').keys.find((k) => k.id === id)!;
    expect(key.provenance).toEqual({
      sources: [{ kind: 'device-rng', vendor: 'Keystone', model: 'Keystone 3 Pro' }],
      generatedBy: { vendor: 'Keystone', model: 'Keystone 3 Pro' },
      independentlyVerified: false,
    });
    expect(isBlankProvenance(key)).toBe(false);
  });

  it('conserva las fuentes conocidas y completa el RNG de fabricante desconocido', () => {
    const m = updateKey(casa, 'k2', {
      provenance: { sources: [{ kind: 'dice', count: 99 }, { kind: 'device-rng', vendor: 'Desconocido' }], independentlyVerified: true },
    });
    const key = setKeyGeneratedOn(m, 'k2', 'seedsigner').keys.find((k) => k.id === 'k2')!;
    expect(key.provenance.sources).toEqual([{ kind: 'dice', count: 99 }, { kind: 'device-rng', vendor: 'SeedSigner' }]);
    expect(key.provenance.generatedBy).toEqual({ vendor: 'SeedSigner' });
    expect(key.provenance.independentlyVerified).toBe(true);
  });

  it('copia el firmware actual del dispositivo', () => {
    const m = updateDevice(casa, 'keystone', { firmware: '2.0.4' });
    expect(setKeyGeneratedOn(m, 'k3', 'keystone').keys.find((k) => k.id === 'k3')!.provenance.generatedBy).toEqual({
      vendor: 'Keystone',
      model: 'Keystone 3 Pro',
      firmware: '2.0.4',
    });
  });

  it('con un dispositivo que no existe no cambia nada', () => {
    expect(setKeyGeneratedOn(casa, 'k1', 'nada')).toBe(casa);
  });
});

describe('ordenar los ids al exportar', () => {
  const r05 = fixture('referencia/r05-passphrase-copia-aparte');

  it('cambia los ids por defecto por el de su nombre, en todas las referencias', () => {
    const m = tidyIds(r05);
    expect(m.locations.map((l) => l.id)).toEqual(['casa', 'caja-fuerte', 'casa-padres']);
    expect(m.people.map((p) => p.id)).toEqual(['yo', 'pareja']);
    expect(m.devices.map((d) => [d.id, d.location])).toEqual([['trezor', 'casa']]);
    expect(m.artifacts.map((a) => [a.id, a.location])).toEqual([
      ['backup-k1', 'caja-fuerte'],
      ['backup-passphrase', 'casa-padres'],
    ]);
    expect(m.locations.find((l) => l.id === 'caja-fuerte')!.inside).toBe('casa');
    expect(m.locations.find((l) => l.id === 'casa-padres')!.access).toContainEqual({ person: 'pareja', when: { type: 'after-death', person: 'yo' } });
    expect(m.people[0]!.knows).toContainEqual({ type: 'pin', device: 'trezor' });
    expect(errors(m)).toEqual([]);
  });

  it('no toca los ids puestos a mano ni los de las keys, y es idempotente', () => {
    expect(tidyIds(casa)).toBe(casa);
    const once = tidyIds(r05);
    expect(tidyIds(once)).toBe(once);
    expect(once.keys).toEqual(r05.keys);
  });

  it('sin cambiar el nombre, el id por defecto se queda; con nombres repetidos, numera', () => {
    const a = addDevice(casa, 'casa');
    expect(tidyIds(a.model)).toBe(a.model);
    const b = addDevice(updateDevice(a.model, a.id, { label: 'Coldcard Q' }), 'casa');
    const m = tidyIds(updateDevice(b.model, b.id, { label: 'Casa' }));
    expect(m.devices.map((d) => d.id)).toEqual(['keystone', 'seedsigner', 'coldcard-q', 'casa-2']);
    expect(errors(m)).toEqual([]);
  });

  it('los nombres de lo nuevo vienen de fuera (en el idioma de la interfaz); los ids, no, y al exportar salen del nombre', () => {
    const blank = blankModel({ scheme: 'My scheme', owner: 'Me', home: 'Home' });
    expect([blank.name, blank.people[0]!.name, blank.locations[0]!.name]).toEqual(['My scheme', 'Me', 'Home']);
    const p = addPerson(casa, 'New person');
    const l = addLocation(p.model, 'New location');
    const d = addDevice(l.model, 'casa', 'stateless', 'New stateless signer');
    const a = addArtifact(d.model, 'casa', (key) => `${key} backup`);
    expect([p.id, l.id, d.id, a.id]).toEqual(['nueva-persona', 'nueva-ubicacion', 'nuevo-firmante-stateless', 'nuevo-backup']);
    expect(a.model.artifacts.at(-1)!.label).toBe('K1 backup');
    const tidy = tidyIds(a.model);
    expect(tidy.people.at(-1)!.id).toBe('new-person');
    expect(tidy.devices.at(-1)!.id).toBe('new-stateless-signer');
    expect(errors(tidy)).toEqual([]);
  });
});

describe('propiedad: editar nunca rompe el modelo', () => {
  it('cualquier secuencia de operaciones deja un modelo válido', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FIXTURES),
        fc.array(fc.tuple(fc.nat(ops.length - 1), fc.array(fc.nat(1000), { minLength: 4, maxLength: 4 })), { maxLength: 25 }),
        (name, steps) => {
          let m = fixture(name);
          for (const [op, seeds] of steps) {
            let i = 0;
            m = ops[op]!(m, (n) => seeds[i++ % seeds.length]! % n);
            expect(errors(m)).toEqual([]);
            expect(errors(tidyIds(m))).toEqual([]);
          }
        },
      ),
    );
  });
});
