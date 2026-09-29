import { addKey, addLocation, addPerson, indexModel, setThreshold, updateMeta, type CustodyModel } from '@llave-inglesa/domain';
import { AlertTriangle, BadgeCheck, CircleCheck, MapPin, Plus, UserPlus, XCircle } from 'lucide-react';
import { keyColor } from '../lib/key-colors.ts';
import { issueText, provenanceText } from '../lib/text.ts';
import { useValidation } from '../lib/validation.ts';
import { useDocument } from '../store/document.ts';
import { useSelection, type Selection } from '../store/selection.ts';
import { useScenarioView } from '../store/scenario.ts';
import { Findings } from './Findings.tsx';
import { ScenarioPanel } from './ScenarioPanel.tsx';
import { Button, Field, Section, Segmented, TextArea, TextInput } from './inspector/fields.tsx';
import { Inspector } from './inspector/Inspector.tsx';
import { KeyChip } from './KeyChip.tsx';
import styles from './Sidebar.module.css';

function exists(model: CustodyModel, s: Selection | null): boolean {
  if (!s) return false;
  const lists = { location: model.locations, person: model.people, device: model.devices, artifact: model.artifacts, key: model.keys };
  return lists[s.kind].some((e) => e.id === s.id);
}

/** Prioridad: ficha de lo seleccionado > simulación activa > resumen del esquema. */
export function Sidebar() {
  const model = useDocument((s) => s.model);
  const selected = useSelection((s) => s.selected);
  const view = useScenarioView();
  const mode = exists(model, selected) ? 'inspector' : view ? 'scenario' : 'summary';
  const labels = { inspector: 'Inspector', scenario: 'Simulación', summary: 'Resumen del esquema' };
  return (
    <aside className={styles.sidebar} aria-label={labels[mode]}>
      {mode === 'inspector' && <Inspector />}
      {mode === 'scenario' && view && <ScenarioPanel model={model} view={view} />}
      {mode === 'summary' && <Summary model={model} />}
    </aside>
  );
}

function Summary({ model }: { model: CustodyModel }) {
  const apply = useDocument((s) => s.apply);
  const select = useSelection((s) => s.select);
  const { valid, issues } = useValidation(model);
  const label = indexModel(model).label;

  const create = (make: (m: CustodyModel) => { model: CustodyModel; id: string }, kind: Selection['kind']) => {
    let id = '';
    apply((m) => {
      const r = make(m);
      id = r.id;
      return r.model;
    });
    select({ kind, id });
  };

  const policy = model.policy;
  const n = policy.type === 'thresh' ? policy.of.length : 1;

  return (
    <>
      <Section>
        <Field label="Nombre del esquema">
          {(id) => <TextInput id={id} value={model.name} onChange={(name) => apply((m) => updateMeta(m, { name }), 'meta:name')} />}
        </Field>
        <Field label="Descripción">
          {(id) => (
            <TextArea
              id={id}
              value={model.description ?? ''}
              placeholder="Para qué sirve este esquema, notas…"
              onChange={(description) => apply((m) => updateMeta(m, { description: description || undefined }), 'meta:description')}
            />
          )}
        </Field>
      </Section>

      <Section title="Política de gasto">
        {policy.type === 'thresh' ? (
          <>
            <Segmented
              label="Firmas necesarias"
              value={String(policy.k)}
              options={Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: `${i + 1} de ${n}` }))}
              onChange={(k) => apply((m) => setThreshold(m, Number(k)))}
            />
            <p className={styles.hint}>Cuántas keys hacen falta para gastar.</p>
          </>
        ) : (
          <p className={styles.hint}>Single-sig: basta con una key. Añade otra para convertirlo en multisig.</p>
        )}
      </Section>

      <Section title="Keys" action={<Button icon={Plus} onClick={() => create(addKey, 'key')}>Key</Button>}>
        <ul className={styles.keyList}>
          {model.keys.map((k) => (
            <li key={k.id}>
              <button className={styles.keyItem} onClick={() => select({ kind: 'key', id: k.id })}>
                <span className={styles.keyRow}>
                  <KeyChip label={k.label} color={keyColor(model, k.id)} />
                  {k.passphrase && <span className={styles.badge}>+ passphrase</span>}
                  {k.provenance.independentlyVerified && (
                    <span className={`${styles.badge} ${styles.verified}`} title="Derivación verificada con una herramienta independiente">
                      <BadgeCheck size={12} aria-hidden /> verificada
                    </span>
                  )}
                </span>
                <span className={styles.provenance}>{provenanceText(k)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Añadir al mapa">
        <div className={styles.addRow}>
          <Button icon={MapPin} onClick={() => create((m) => addLocation(m), 'location')}>Ubicación</Button>
          <Button icon={UserPlus} onClick={() => create((m) => addPerson(m), 'person')}>Persona</Button>
        </div>
        <p className={styles.hint}>Los dispositivos y backups se añaden desde cada ubicación. Pulsa cualquier elemento del mapa para editarlo.</p>
      </Section>

      <Findings model={model} />

      <Section title="Validación">
        {issues.length === 0 ? (
          <p className={`${styles.status} ${styles.ok}`}>
            <CircleCheck size={14} aria-hidden /> El modelo es coherente
          </p>
        ) : (
          <ul className={styles.issues}>
            {issues.map((i, n) => (
              <li key={n} className={i.severity === 'error' ? styles.error : styles.warning}>
                {i.severity === 'error' ? <XCircle size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
                {issueText(i, label)}
              </li>
            ))}
          </ul>
        )}
        {!valid && <p className={styles.hint}>Corrige los errores para que el análisis pueda ejecutarse.</p>}
      </Section>

      <Section title="Contenido">
        <dl className={styles.stats}>
          {(
            [
              ['Keys', model.keys.length],
              ['Dispositivos', model.devices.length],
              ['Backups', model.artifacts.length],
              ['Personas', model.people.length],
              ['Ubicaciones', model.locations.length],
            ] as const
          ).map(([name, value]) => (
            <div key={name} className={styles.stat}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
