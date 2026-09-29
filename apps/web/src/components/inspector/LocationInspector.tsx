import { addArtifact, addDevice, removeLocation, updateLocation, type CustodyModel, type Location } from '@llave-inglesa/domain';
import { Camera, Cpu, MapPin, Plus, RectangleHorizontal, X } from 'lucide-react';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, Select, TextInput } from './fields.tsx';
import styles from './fields.module.css';

type Access = Location['access'][number];

const conditionValue = (a: Access) => (a.when.type === 'always' ? 'always' : `after-death:${a.when.person}`);
const parseCondition = (v: string): Access['when'] =>
  v === 'always' ? { type: 'always' } : { type: 'after-death', person: v.slice('after-death:'.length) };

export function LocationInspector({ model, location }: { model: CustodyModel; location: Location }) {
  const apply = useDocument((s) => s.apply);
  const select = useSelection((s) => s.select);
  const id = location.id;
  const setAccess = (access: Access[]) => apply((m) => updateLocation(m, id, { access }));

  const items = [
    ...model.devices.filter((d) => d.location === id).map((d) => ({ kind: 'device' as const, id: d.id, label: d.label, icon: d.kind === 'stateful' ? Cpu : Camera })),
    ...model.artifacts.filter((a) => a.location === id).map((a) => ({ kind: 'artifact' as const, id: a.id, label: a.label, icon: RectangleHorizontal })),
  ];
  const withoutAccess = model.people.filter((p) => !location.access.some((a) => a.person === p.id));

  const create = (make: (m: CustodyModel) => { model: CustodyModel; id: string }, kind: 'device' | 'artifact') => {
    let createdId = '';
    apply((m) => {
      const r = make(m);
      createdId = r.id;
      return r.model;
    });
    select({ kind, id: createdId });
  };

  return (
    <>
      <PanelHeader icon={MapPin} kind="Ubicación" title={location.name} onClose={() => select(null)} />

      <Section>
        <Field label="Nombre">
          {(fid) => <TextInput id={fid} value={location.name} onChange={(name) => apply((m) => updateLocation(m, id, { name }), `location:${id}:name`)} />}
        </Field>
      </Section>

      <Section
        title="Quién puede entrar"
        action={
          withoutAccess.length > 0 && (
            <Button icon={Plus} onClick={() => setAccess([...location.access, { person: withoutAccess[0]!.id, when: { type: 'always' } }])}>
              Acceso
            </Button>
          )
        }
      >
        {location.access.length === 0 && <p className={styles.hint}>Nadie tiene acceso: lo que haya aquí es inalcanzable.</p>}
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
                      { value: 'always', label: 'Siempre' },
                      ...others.map((p) => ({ value: `after-death:${p.id}`, label: `Tras fallecer ${p.name}` })),
                    ]}
                    onChange={(v) => change({ when: parseCondition(v) })}
                  />
                </span>
                <button className={styles.iconButton} onClick={() => setAccess(location.access.filter((_, j) => j !== i))} aria-label="Quitar acceso">
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Qué hay aquí">
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <button className={styles.rowButton} onClick={() => select({ kind: item.kind, id: item.id })}>
                <item.icon size={14} aria-hidden />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.buttonRow}>
          <Button icon={Cpu} onClick={() => create((m) => addDevice(m, id, 'stateful'), 'device')}>Dispositivo</Button>
          <Button icon={Camera} onClick={() => create((m) => addDevice(m, id, 'stateless'), 'device')}>Stateless</Button>
          <Button icon={RectangleHorizontal} onClick={() => create((m) => addArtifact(m, id), 'artifact')}>Backup</Button>
        </div>
      </Section>

      <DeleteButton
        label={items.length ? `Eliminar ubicación y sus ${items.length} objetos` : 'Eliminar ubicación'}
        onClick={() => {
          apply((m) => removeLocation(m, id));
          select(null);
        }}
        disabled={model.locations.length <= 1}
        reason="Tiene que haber al menos una ubicación."
      />
    </>
  );
}
