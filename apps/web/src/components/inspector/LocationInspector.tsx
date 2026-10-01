import { addArtifact, addDevice, canNest, removeLocation, setLocationInside, setLocationProtection, updateLocation, type CustodyModel, type Location } from '@llave-inglesa/domain';
import { Camera, Cpu, MapPin, Plus, RectangleHorizontal, X } from 'lucide-react';
import { locationIcon } from '../../graph/LocationNode.tsx';
import { useDocument } from '../../store/document.ts';
import { useSelection } from '../../store/selection.ts';
import { Button, DeleteButton, Field, PanelHeader, Section, Segmented, Select, TextInput } from './fields.tsx';
import styles from './fields.module.css';

type Access = Location['access'][number];

const KIND_OPTIONS = [
  { value: 'physical', label: 'Física' },
  { value: 'device', label: 'Dispositivo' },
  { value: 'cloud', label: 'Nube' },
] as const;

const KIND_HINT: Record<Location['kind'], string> = {
  physical: 'Casa, caja del banco… Se ataca con una intrusión y se pierde con un incendio o una inundación.',
  device: 'Portátil, disco duro… Se ataca con robo o malware y se pierde con una avería o un robo.',
  cloud: 'Una cuenta en la nube. Se ataca en remoto (hackeo) y se pierde si se cierra o pierdes el acceso. Cifra lo que guardes aquí.',
};

const PROTECTION_OPTIONS = [
  { value: 'none', label: 'Ninguna' },
  { value: 'home-safe', label: 'Caja fuerte' },
  { value: 'bank-box', label: 'Caja del banco' },
] as const;

const PROTECTION_HINT: Record<(typeof PROTECTION_OPTIONS)[number]['value'], string> = {
  none: 'Una casa, un piso, una oficina… Entrar sin nadie presente cuesta poco.',
  'home-safe': 'Una caja fuerte doméstica: hay que encontrarla y forzarla. Si está dentro de casa, el robo exige entrar en ambas, y un incendio o una inundación en casa también le llegan.',
  'bank-box': 'Una caja de seguridad en un banco: lo más difícil de asaltar. Para obligarte a abrirla hay que llevarte allí en horario, y su cámara acorazada resiste mucho mejor un incendio o una inundación.',
};

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
      <PanelHeader icon={MapPin} kind="Ubicación" title={location.name} />

      <Section>
        <Field label="Nombre">
          {(fid) => <TextInput id={fid} value={location.name} onChange={(name) => apply((m) => updateLocation(m, id, { name }), `location:${id}:name`)} />}
        </Field>
        <Segmented label="Tipo de ubicación" value={location.kind} options={KIND_OPTIONS} onChange={(kind) => apply((m) => updateLocation(m, id, { kind }))} />
        <p className={styles.hint}>{KIND_HINT[location.kind]}</p>
      </Section>

      {location.kind === 'physical' && (
        <Section title="Protección">
          <Segmented
            label="Protección"
            value={location.protection ?? 'none'}
            options={PROTECTION_OPTIONS}
            onChange={(p) => apply((m) => setLocationProtection(m, id, p === 'none' ? undefined : p))}
          />
          <p className={styles.hint}>{PROTECTION_HINT[location.protection ?? 'none']}</p>
          {contained.length > 0 ? (
            <>
              <p className={styles.hint}>Dentro de esta ubicación hay otras, así que no puede ir dentro de ninguna:</p>
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
            <Field label="Dentro de" hint="P. ej. la caja fuerte, dentro de Casa: para llegar a ella hay que entrar primero en la casa.">
              {(fid) => (
                <Select
                  id={fid}
                  value={location.inside ?? NOT_INSIDE}
                  options={[{ value: NOT_INSIDE, label: 'Ninguna: está por su cuenta' }, ...containers.map((l) => ({ value: l.id, label: l.name }))]}
                  onChange={(parent) => apply((m) => setLocationInside(m, id, parent === NOT_INSIDE ? undefined : parent))}
                />
              )}
            </Field>
          )}
        </Section>
      )}

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
        <p className={styles.hint}>"No puede actuar" = incapacidad o fallecimiento (p. ej. poder notarial preventivo o tutela).</p>
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
                      ...others.flatMap((p) => [
                        { value: `after-death:${p.id}`, label: `Tras fallecer ${p.name}` },
                        { value: `incapacity-or-death:${p.id}`, label: `Si ${p.name} no puede actuar` },
                      ]),
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
              <button className={styles.rowButton} onClick={() => open({ kind: item.kind, id: item.id })}>
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
          back();
        }}
        disabled={model.locations.length <= 1}
        reason="Tiene que haber al menos una ubicación."
      />
    </>
  );
}
