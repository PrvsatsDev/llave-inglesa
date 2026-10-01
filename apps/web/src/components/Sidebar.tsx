import { addKey, addLocation, addPerson, indexModel, setThreshold, updateMeta, type CustodyModel } from '@llave-inglesa/domain';
import { AlertTriangle, BadgeCheck, CircleCheck, MapPin, Plus, UserPlus, XCircle } from 'lucide-react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { keyColor } from '../lib/key-colors.ts';
import { issueText, plural, provenanceText } from '../lib/text.ts';
import { useValidation } from '../lib/validation.ts';
import { useAnalysis } from '../store/analysis.ts';
import { useDocument } from '../store/document.ts';
import { PANEL_DEFAULT, PANEL_MAX, PANEL_MIN, useLayout } from '../store/layout.ts';
import { useSelection, type Selection } from '../store/selection.ts';
import { useNavigation, type Section as SectionId } from '../store/navigation.ts';
import { useScenarioView } from '../store/scenario.ts';
import { LossRoutes, TheftRoutes, TryScenario } from './Findings.tsx';
import { ScenarioPanel } from './ScenarioPanel.tsx';
import { Scoreboard } from './Scoreboard.tsx';
import { Button, Field, Section, Segmented, TextArea, TextInput } from './inspector/fields.tsx';
import { Inspector } from './inspector/Inspector.tsx';
import { KeyChip } from './KeyChip.tsx';
import { Breadcrumbs, SectionTabs } from './Navigation.tsx';
import styles from './Sidebar.module.css';

function exists(model: CustodyModel, s: Selection | null): boolean {
  if (!s) return false;
  const lists = { location: model.locations, person: model.people, device: model.devices, artifact: model.artifacts, key: model.keys };
  return lists[s.kind].some((e) => e.id === s.id);
}

/**
 * Columna izquierda: secciones, puntuaciones, migas de pan y el contenido.
 * La ficha de un elemento se abre encima de la sección en la que se estaba, y "volver" regresa a ella.
 */
export function Sidebar() {
  const model = useDocument((s) => s.model);
  const selected = useSelection((s) => s.selected);
  const collapsed = useLayout((s) => s.collapsed);
  const section = useNavigation((s) => s.section);
  return (
    <aside className={styles.sidebar} aria-label="Panel">
      {!collapsed && <SectionTabs model={model} />}
      <Scoreboard />
      {!collapsed && (
        <>
          <Breadcrumbs model={model} />
          <div className={styles.content}>
            {exists(model, selected) ? <Inspector /> : <SectionContent section={section} model={model} />}
          </div>
          <ResizeHandle />
        </>
      )}
    </aside>
  );
}

function SectionContent({ section, model }: { section: SectionId; model: CustodyModel }) {
  const view = useScenarioView();
  const metric = useNavigation((s) => s.metric);
  if (section === 'schema') return <Summary model={model} />;
  if (section === 'simulate') return view ? <ScenarioPanel model={model} view={view} /> : <TryScenario model={model} />;
  switch (metric) {
    case 'security':
      return <TheftRoutes model={model} />;
    case 'resilience':
      return <LossRoutes model={model} />;
    case 'usability':
    case 'inheritance':
      return <MetricDetail metric={metric} />;
  }
}

/** Provisional: la línea de detalle de la tarjeta, hasta que estas métricas tengan su propia lista. */
function MetricDetail({ metric }: { metric: 'usability' | 'inheritance' }) {
  const analysis = useAnalysis((s) => s.analysis);
  if (!analysis) return null;
  const text =
    metric === 'usability'
      ? analysis.usability.locations
        ? `Para firmar hay que ir a ${plural(analysis.usability.locations.length, 'ubicación', 'ubicaciones')}.`
        : 'No se puede firmar de forma segura.'
      : analysis.inheritance.status === 'ok'
        ? `Los herederos recuperan los fondos yendo a ${plural(analysis.inheritance.locations!.length, 'ubicación', 'ubicaciones')}.`
        : analysis.inheritance.status === 'no-heirs'
          ? 'No hay herederos en el esquema.'
          : 'Los herederos no podrían recuperar los fondos.';
  return (
    <Section>
      <p className={styles.provenance}>{text}</p>
    </Section>
  );
}

/** Asa para cambiar el ancho de la columna: arrastrar, flechas del teclado o doble clic para el ancho por defecto. */
function ResizeHandle() {
  const width = useLayout((s) => s.width);
  const setWidth = useLayout((s) => s.setWidth);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    const left = handle.parentElement!.getBoundingClientRect().left;
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setWidth(ev.clientX - left);
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 64 : 16;
    if (e.key === 'ArrowLeft') setWidth(width - step);
    else if (e.key === 'ArrowRight') setWidth(width + step);
    else return;
    e.preventDefault();
  };
  return (
    <div
      className={styles.resize}
      role="separator"
      aria-orientation="vertical"
      aria-label="Ancho del panel"
      aria-valuemin={PANEL_MIN}
      aria-valuemax={PANEL_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Arrastra para cambiar el ancho (doble clic: ancho por defecto)"
      onPointerDown={onPointerDown}
      onDoubleClick={() => setWidth(PANEL_DEFAULT)}
      onKeyDown={onKeyDown}
    />
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
