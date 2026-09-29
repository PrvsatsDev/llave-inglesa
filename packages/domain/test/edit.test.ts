import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  activeHolds,
  isActiveSecret,
  addArtifact,
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
  removePerson,
  setArtifactPassword,
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
    expect(m.devices.find((d) => d.id === 'ccq')!.holds).toEqual([]);
    expect(m.artifacts.find((a) => a.id === 'metal-k1')).toBeUndefined();
    expect(errors(m)).toEqual([]);
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
    const off = updateDevice(casa, 'ccq', { pinProtected: false });
    const pin = { type: 'pin', device: 'ccq' } as const;
    expect(off.people[0]!.knows).toEqual([pin]);
    expect(isActiveSecret(off, pin)).toBe(false);
    expect(isActiveSecret(updateDevice(off, 'ccq', { pinProtected: true }), pin)).toBe(true);
  });

  it('desactivar la passphrase conserva sus backups como latentes', () => {
    const m = updateKey(fixture('singlesig-passphrase'), 'k1', { passphrase: false });
    expect(m.artifacts.find((a) => a.id === 'papel-pass')).toBeDefined();
    expect(isActiveSecret(m, { type: 'passphrase', key: 'k1' })).toBe(false);
  });

  it('un dispositivo que pasa a stateless conserva sus keys como latentes', () => {
    const d = updateDevice(casa, 'ccq', { kind: 'stateless' }).devices.find((x) => x.id === 'ccq')!;
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
    expect(removeDevice(casa, 'ccq').people[0]!.knows).toEqual([]);
  });

  it('el umbral se limita a 1..N', () => {
    expect(setThreshold(casa, 9).policy).toMatchObject({ k: 3 });
    expect(setThreshold(casa, 0).policy).toMatchObject({ k: 1 });
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
];

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
          }
        },
      ),
    );
  });
});
