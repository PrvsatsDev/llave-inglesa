import {
  addPolicyChild,
  BLOCKS_PER_DAY,
  convertShape,
  flatPolicy,
  indexModel,
  MAX_OLDER_BLOCKS,
  policyKeys,
  policyMiniscriptReason,
  policyRoot,
  policyShape,
  policyTimelocks,
  removePolicyNode,
  setPolicyBlocks,
  setPolicyGroupThreshold,
  setPolicyKey,
  setPolicyShape,
  setRenewal,
  setShapeBlocks,
  setShapeSpecialKey,
  setShapeThreshold,
  SHAPE_KINDS,
  SHAPE_MIN_KEYS,
  shapeKeys,
  shapeThresholds,
  type CustodyModel,
  type PolicyChildKind,
  type PolicyGroup,
  type PolicyPath,
  type PolicyShape,
  type ShapeKind,
} from '@llave-inglesa/domain';
import { renewsInTime, spendStages } from '@llave-inglesa/engine';
import { AlertTriangle, Check, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { policyText, spendStageText, UI, walletProblemText } from '../lib/text.ts';
import { useDocument } from '../store/document.ts';
import { Field, NumberInput, Section, Segmented, Select } from './inspector/fields.tsx';
import styles from './Schema.module.css';

const T = UI.esquema;

const MONTH = 30 * BLOCKS_PER_DAY;
type Unit = 'days' | 'months';
const MAX = { days: Math.floor(MAX_OLDER_BLOCKS / BLOCKS_PER_DAY), months: Math.floor(MAX_OLDER_BLOCKS / MONTH) };
const naturalUnit = (blocks: number): Unit => (blocks % MONTH === 0 ? 'months' : 'days');

/** La opción del selector de forma que no es una plantilla. */
const FREE = 'free';
type Form = ShapeKind | typeof FREE;

/**
 * Política de gasto: su forma (una plantilla, con sus parámetros) o un árbol libre. Una política que no es una
 * plantilla se edita siempre como árbol; una que lo es, también si se elige «Personalizada».
 */
export function PolicySection({ model }: { model: CustodyModel }) {
  const apply = useDocument((s) => s.apply);
  const [freeChosen, setFreeChosen] = useState(false);
  const shape = policyShape(model.policy);
  const label = indexModel(model).label;
  const set = (next: PolicyShape | null, merge?: string) => next && apply((m) => setPolicyShape(m, next), merge);

  const keys = shape ? shapeKeys(shape) : policyKeys(model.policy);
  const form: Form = shape && !freeChosen ? shape.kind : FREE;
  const reason = flatPolicy(model) ? null : policyMiniscriptReason(model.policy);
  const timelocks = policyTimelocks(model.policy);

  return (
    <Section title={T.politica}>
      <p className={styles.description}>{policyText(model.policy, label)}</p>
      <Field label={T.forma} hint={form === FREE ? T.pistaFormaLibre : T.pistaForma[form]}>
        {(id) => (
          <Select<Form>
            id={id}
            value={form}
            options={[
              ...SHAPE_KINDS.map((kind) => {
                const disabled = keys.length < SHAPE_MIN_KEYS[kind];
                return { value: kind, label: disabled ? `${T.formas[kind]} (${T.necesitaKeys(SHAPE_MIN_KEYS[kind])})` : T.formas[kind], disabled };
              }),
              { value: FREE, label: T.formaLibre },
            ]}
            onChange={(next) => {
              setFreeChosen(next === FREE);
              if (next !== FREE) set(convertShape(shape ?? { kind: 'plain', k: 1, keys }, next));
            }}
          />
        )}
      </Field>
      {form === FREE || !shape ? <PolicyTree model={model} /> : <ShapeFields model={model} shape={shape} />}
      {timelocks.length > 0 && (
        <Renewal model={model} blocks={timelocks[0]!} onChange={(days) => apply((m) => setRenewal(m, days), 'renewal')} />
      )}
      {reason && (
        <p className={styles.warn}>
          <AlertTriangle size={13} aria-hidden />
          {walletProblemText({ code: 'no-miniscript', reason }, label)}
        </p>
      )}
    </Section>
  );
}

/** Los parámetros de una plantilla: umbral, key aparte y espera. */
function ShapeFields({ model, shape }: { model: CustodyModel; shape: PolicyShape }) {
  const apply = useDocument((s) => s.apply);
  const label = indexModel(model).label;
  const set = (next: PolicyShape | null, merge?: string) => next && apply((m) => setPolicyShape(m, next), merge);
  const total = shapeKeys(shape).length;
  const { min, max } = shapeThresholds(shape.kind, shape.keys.length);
  const special = shape.kind === 'inheritance' ? shape.recovery : shape.kind === 'expanding' ? shape.extra : null;
  return (
    <>
      {total === 1 ? (
        <p className={styles.hint}>{T.singleSig}</p>
      ) : (
        max > 1 && (
          <>
            <Segmented
              label={shape.kind === 'plain' ? T.firmasNecesarias : T.firmasPrincipales}
              value={String(shape.k)}
              options={Array.from({ length: max - min + 1 }, (_, i) => ({ value: String(min + i), label: T.kDeN(min + i, shape.keys.length) }))}
              onChange={(k) => set(setShapeThreshold(shape, Number(k)))}
            />
            {shape.kind === 'plain' && <p className={styles.hint}>{T.pistaFirmas}</p>}
          </>
        )
      )}
      {special && (
        <Field label={shape.kind === 'inheritance' ? T.keyRecuperacion : T.keyExtra}>
          {(id) => (
            <Select id={id} value={special} options={shapeKeys(shape).map((k) => ({ value: k, label: label(k) }))} onChange={(k) => set(setShapeSpecialKey(shape, k))} />
          )}
        </Field>
      )}
      {shape.kind !== 'plain' && (
        <Field label={T.espera} hint={T.pistaEspera(shape.blocks)}>
          {(id) => <WaitInputs id={id} blocks={shape.blocks} onChange={(blocks) => set(setShapeBlocks(shape, blocks), 'policy:blocks')} />}
        </Field>
      )}
    </>
  );
}

/** El árbol libre: la raíz como grupo, con sus hijos anidados. */
function PolicyTree({ model }: { model: CustodyModel }) {
  return (
    <>
      <SpendStages model={model} />
      <div className={styles.tree}>
        <Group model={model} group={policyRoot(model.policy)} path={[]} />
      </div>
    </>
  );
}

/** El árbol en llano: qué basta para gastar sin esperar y qué más basta según pasa el tiempo. */
function SpendStages({ model }: { model: CustodyModel }) {
  const stages = spendStages(model.policy);
  if (!stages || stages.length === 0) return null;
  const label = indexModel(model).label;
  return (
    <div className={styles.stages}>
      <p className={styles.stagesTitle}>{T.formasDeGastar}</p>
      <ul>
        {stages.map((stage) => {
          const { when, keys } = spendStageText(stage, label);
          return (
            <li key={stage.wait}>
              <strong>{when}:</strong> {keys}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ADD: readonly { kind: PolicyChildKind; text: () => string }[] = [
  { kind: 'key', text: () => T.anadirKey },
  { kind: 'older', text: () => T.anadirEspera },
  { kind: 'group', text: () => T.anadirGrupo },
];

/** «Hacen falta k de:» sus hijos, y los botones para añadir más. */
function Group({ model, group, path }: { model: CustodyModel; group: PolicyGroup; path: PolicyPath }) {
  const apply = useDocument((s) => s.apply);
  const n = group.of.length;
  return (
    <div className={styles.group} role="group" aria-label={path.length === 0 ? T.politica : T.grupo}>
      <div className={styles.groupHeader}>
        <span>{group.k === 1 && n > 1 ? T.bastaCon : T.hacenFalta}</span>
        <Select
          label={T.hacenFalta}
          value={String(group.k)}
          options={Array.from({ length: n }, (_, i) => ({
            value: String(i + 1),
            label: i + 1 === n && n > 1 ? T.todas(n) : T.kDeN(i + 1, n),
            disabled: i + 1 !== group.k && setPolicyGroupThreshold(model, path, i + 1) === model,
          }))}
          onChange={(k) => apply((m) => setPolicyGroupThreshold(m, path, Number(k)))}
        />
        {path.length > 0 && <Remove model={model} path={path} />}
      </div>
      <ul className={styles.children}>
        {group.of.map((child, i) => {
          const at = [...path, i];
          return (
            <li key={i}>
              {child.type === 'thresh' ? (
                <Group model={model} group={child} path={at} />
              ) : (
                <div className={child.type === 'older' ? `${styles.leaf} ${styles.waitCard}` : styles.leaf}>
                  {child.type === 'key' ? (
                    <Select
                      label={T.key}
                      value={child.key}
                      options={model.keys.map((k) => ({
                        value: k.id,
                        label: k.label,
                        disabled: k.id !== child.key && setPolicyKey(model, at, k.id) === model,
                      }))}
                      onChange={(key) => apply((m) => setPolicyKey(m, at, key))}
                    />
                  ) : (
                    <WaitInputs blocks={child.blocks} label={T.espera} onChange={(blocks) => apply((m) => setPolicyBlocks(m, at, blocks), `policy:blocks:${at.join('.')}`)} />
                  )}
                  <Remove model={model} path={at} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className={styles.addRow}>
        <span className={styles.hint}>{T.anadir}</span>
        {ADD.map(({ kind, text }) => (
          <button key={kind} className={styles.addButton} onClick={() => apply((m) => addPolicyChild(m, path, kind))}>
            <Plus size={12} aria-hidden />
            {text()}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Quitar un nodo; desactivado (y explicado) si dejaría gastar sin firmar. */
function Remove({ model, path }: { model: CustodyModel; path: PolicyPath }) {
  const apply = useDocument((s) => s.apply);
  const blocked = removePolicyNode(model, path) === model;
  return (
    <button className={styles.removeButton} aria-label={T.quitar} title={blocked ? T.noSeQuita : T.quitar} disabled={blocked} onClick={() => apply((m) => removePolicyNode(m, path))}>
      <X size={14} aria-hidden />
    </button>
  );
}

/** La espera, en días o meses (se guarda en bloques). */
function WaitInputs({ id, blocks, label, onChange }: { id?: string; blocks: number; label?: string; onChange(blocks: number): void }) {
  const [chosen, setUnit] = useState<Unit | null>(null);
  // Si la espera no cabe en meses enteros, se muestra en días.
  const unit = chosen === 'months' && blocks % MONTH !== 0 ? 'days' : (chosen ?? naturalUnit(blocks));
  const per = unit === 'months' ? MONTH : BLOCKS_PER_DAY;
  const value = Math.max(1, Math.round(blocks / per));
  return (
    <span className={styles.inline} title={label && T.pistaEspera(blocks)}>
      {label && <span className={styles.unit}>{label}</span>}
      <NumberInput id={id} label={label} value={value} min={1} max={MAX[unit]} onChange={(v) => v !== undefined && onChange(v * per)} />
      <Select<Unit>
        value={unit}
        label={label && T.unidadEspera}
        options={(['days', 'months'] as const).map((u) => ({ value: u, label: T.unidades[u] }))}
        onChange={(u) => {
          setUnit(u);
          // Al pasar a meses, se redondea a meses enteros.
          if (u === 'months') onChange(Math.min(MAX.months, Math.max(1, Math.round(blocks / MONTH))) * MONTH);
        }}
      />
    </span>
  );
}

/** Cada cuántos días mueve el titular las monedas. Con varias esperas, se compara con la más corta. */
function Renewal({ model, blocks, onChange }: { model: CustodyModel; blocks: number; onChange(days: number | undefined): void }) {
  const days = model.renewal?.everyDays;
  const inTime = renewsInTime(model, blocks);
  return (
    <Field label={T.renovacion} hint={T.pistaRenovacion}>
      {(id) => (
        <>
          <span className={styles.inline}>
            <NumberInput id={id} value={days} min={1} max={9999} optional placeholder={T.sinIndicar} onChange={onChange} />
            <span className={styles.unit}>{T.dias}</span>
          </span>
          {days !== undefined && (
            <p className={inTime ? styles.ok : styles.warn}>
              {inTime ? <Check size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}
              {inTime ? T.renuevasATiempo : T.renuevasTarde}
            </p>
          )}
        </>
      )}
    </Field>
  );
}
