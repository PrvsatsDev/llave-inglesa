import { addArtifact, addDevice, canNest, removeLocation, setLocationInside, setLocationProtection, updateLocation, type CustodyModel, type Location } from '@llave-inglesa/domain';
import { Camera, Cpu, MapPin, Plus, RectangleHorizontal, X } from 'lucide-react';
import { locationIcon } from '../../graph/LocationNode.tsx';
import { UI } from '../../lib/text.ts';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, Segmented, Select, TextInput } from './fields.tsx';
import styles from './fields.module.css';

type Access = Location['access'][number];

const T = UI.ubicacion;

const KIND_OPTIONS = (['physical', 'device', 'cloud'] as const).map((value) => ({ value, label: T.tipos[value] }));
const KIND_HINT: Record<Location['kind'], string> = T.pistasTipo;

const PROTECTION_OPTIONS = (['none', 'home-safe', 'bank-box'] as const).map((value) => ({ value, label: T.protecciones[value] }));
const PROTECTION_HINT: Record<(typeof PROTECTION_OPTIONS)[number]['value'], string> = T.pistasProteccion;

const NOT_INSIDE = '';

/** Codifica la condición como valor de <select>: "always" o "tipo:persona". */
const conditionValue = (a: Access) => (a.when.type === 'always' ? 'always' : `${a.when.type}:${a.when.person}`);
function parseCondition(v: string): Access['when'] {
  if (v === 'always') return { type: 'always' };
  const [type, person = ''] = v.split(':') as ['after-death' | 'incapacity-or-death', string];
  return { type, person };
}

export function LocationInspector({ model, location }: { model: CustodyModel; location: Location }) {
  const apply = useDocument((s) => s.apply);
  const back = useSelection((s) => s.back);
  const open = useSelection((s) => s.open);
  const id = location.id;
  const setAccess = (access: Access[]) => apply((m) => updateLocation(m, id, { access }));

  const items = [
    ...model.devices.filter((d) => d.location === id).map((d) => ({ kind: 'device' as const, id: d.id, label: d.label, icon: d.kind === 'stateful' ? Cpu : Camera })),
    ...model.artifacts.filter((a) => a.location === id).map((a) => ({ kind: 'artifact' as const, id: a.id, label: a.label, icon: RectangleHorizontal })),
  ];
  const withoutAccess = model.people.filter((p) => !location.access.some((a) => a.person === p.id));
  const contained = model.locations.filter((l) => l.inside === id);
  const containers = model.locations.filter((l) => l.id === location.inside || canNest(model, id, l.id));

  const create = (make: (m: CustodyModel) => { model: CustodyModel; id: string }, kind: 'device' | 'artifact') => {
    let createdId = '';
    apply((m) => {
      const r = make(m);
      createdId = r.id;
      return r.model;
    });
    open({ kind, id: createdId });
  };

  return (
    <>
      <PanelHeader icon={MapPin} kind={T.tipo} title={location.name} />

      <Section>
        <Field label={UI.campos.nombre}>
          {(fid) => <TextInput id={fid} value={location.name} onChange={(name) => apply((m) => updateLocation(m, id, { name }), `location:${id}:name`)} />}
        </Field>
        <Segmented label={T.tipoUbicacion} value={location.kind} options={KIND_OPTIONS} onChange={(kind) => apply((m) => updateLocation(m, id, { kind }))} />
        <p className={styles.hint}>{KIND_HINT[location.kind]}</p>
      </Section>

      {location.kind === 'physical' && (
        <Section title={T.proteccion}>
          <Segmented
            label={T.proteccion}
            value={location.protection ?? 'none'}
            options={PROTECTION_OPTIONS}
            onChange={(p) => apply((m) => setLocationProtection(m, id, p === 'none' ? undefined : p))}
          />
          <p className={styles.hint}>{PROTECTION_HINT[location.protection ?? 'none']}</p>
          {contained.length > 0 ? (
            <>
              <p className={styles.hint}>{T.contieneOtras}</p>
              <ul className={styles.list}>
                {contained.map((l) => {
                  const Icon = locationIcon(l);
                  return (
                    <li key={l.id}>
                      <button className={styles.rowButton} onClick={() => open({ kind: 'location', id: l.id })}>
                        <Icon size={14} aria-hidden />
                        {l.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <Field label={T.dentroDe} hint={T.pistaDentroDe}>
              {(fid) => (
                <Select
                  id={fid}
                  value={location.inside ?? NOT_INSIDE}
                  options={[{ value: NOT_INSIDE, label: T.porSuCuenta }, ...containers.map((l) => ({ value: l.id, label: l.name }))]}
                  onChange={(parent) => apply((m) => setLocationInside(m, id, parent === NOT_INSIDE ? undefined : parent))}
                />
              )}
            </Field>
          )}
        </Section>
      )}

      <Section
        title={T.quienEntra}
        action={
          withoutAccess.length > 0 && (
            <Button icon={Plus} onClick={() => setAccess([...location.access, { person: withoutAccess[0]!.id, when: { type: 'always' } }])}>
              {T.acceso}
            </Button>
          )
        }
      >
        {location.access.length === 0 && <p className={styles.hint}>{T.nadie}</p>}
        <p className={styles.hint}>{T.pistaNoPuede}</p>
        <ul className={styles.list}>
          {location.access.map((a, i) => {
            const others = model.people.filter((p) => p.id !== a.person);
            const change = (patch: Partial<Access>) => setAccess(location.access.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <li key={i} className={styles.row}>
                <span className={styles.rowGrow}>
                  <Select
                    value={a.person}
                    options={model.people.filter((p) => p.id === a.person || withoutAccess.includes(p)).map((p) => ({ value: p.id, label: p.name }))}
                    onChange={(person) => change({ person })}
                  />
                </span>
                <span className={styles.rowGrow}>
                  <Select
                    value={conditionValue(a)}
                    options={[
                      { value: 'always', label: T.siempre },
                      ...others.flatMap((p) => [
                        { value: `after-death:${p.id}`, label: T.trasFallecer(p.name) },
                        { value: `incapacity-or-death:${p.id}`, label: T.siNoPuede(p.name) },
                      ]),
                    ]}
                    onChange={(v) => change({ when: parseCondition(v) })}
                  />
                </span>
                <button className={styles.iconButton} onClick={() => setAccess(location.access.filter((_, j) => j !== i))} aria-label={T.quitarAcceso}>
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={T.queHay}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button className={styles.rowButton} onClick={() => open({ kind: item.kind, id: item.id })}>
                <item.icon size={14} aria-hidden />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.buttonRow}>
          <Button icon={Cpu} onClick={() => create((m) => addDevice(m, id, 'stateful'), 'device')}>{T.dispositivo}</Button>
          <Button icon={Camera} onClick={() => create((m) => addDevice(m, id, 'stateless'), 'device')}>{T.stateless}</Button>
          <Button icon={RectangleHorizontal} onClick={() => create((m) => addArtifact(m, id), 'artifact')}>{T.backup}</Button>
        </div>
      </Section>

      <DeleteButton
        label={items.length ? T.eliminarCon(items.length) : T.eliminar}
        onClick={() => {
          apply((m) => removeLocation(m, id));
          back();
        }}
        disabled={model.locations.length <= 1}
        reason={T.haceFalta}
      />
    </>
  );
}
