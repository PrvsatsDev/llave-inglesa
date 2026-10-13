import {
  BLOCKS_PER_DAY,
  MAX_OLDER_BLOCKS,
  SHAPE_KINDS,
  SHAPE_MIN_KEYS,
  convertShape,
  indexModel,
  policyShape,
  setPolicyShape,
  setRenewal,
  setShapeBlocks,
  setShapeSpecialKey,
  setShapeThreshold,
  shapeKeys,
  shapeThresholds,
  type CustodyModel,
  type PolicyShape,
  type ShapeKind,
} from '@llave-inglesa/domain';
import { renewsInTime } from '@llave-inglesa/engine';
import { AlertTriangle, Check } from 'lucide-react';
import { useState } from 'react';
import { policyText, UI } from '../lib/text.ts';
import { useDocument } from '../store/document.ts';
import { Field, NumberInput, Section, Segmented, Select } from './inspector/fields.tsx';
import styles from './Schema.module.css';

const T = UI.esquema;

const MONTH = 30 * BLOCKS_PER_DAY;
type Unit = 'days' | 'months';
const MAX = { days: Math.floor(MAX_OLDER_BLOCKS / BLOCKS_PER_DAY), months: Math.floor(MAX_OLDER_BLOCKS / MONTH) };
const naturalUnit = (blocks: number): Unit => (blocks % MONTH === 0 ? 'months' : 'days');

/** Política de gasto: su forma (plantilla) y sus parámetros. Una política que no es una plantilla solo se lee. */
export function PolicySection({ model }: { model: CustodyModel }) {
  const apply = useDocument((s) => s.apply);
  const shape = policyShape(model.policy);
  const label = indexModel(model).label;
  const set = (next: PolicyShape | null, merge?: string) => next && apply((m) => setPolicyShape(m, next), merge);

  if (!shape) {
    return (
      <Section title={T.politica}>
        <p className={styles.description}>{policyText(model.policy, label)}</p>
        <p className={styles.hint}>{T.pistaRamas}</p>
      </Section>
    );
  }

  const total = shapeKeys(shape).length;
  const { min, max } = shapeThresholds(shape.kind, shape.keys.length);
  const special = shape.kind === 'inheritance' ? shape.recovery : shape.kind === 'expanding' ? shape.extra : null;

  return (
    <Section title={T.politica}>
      <p className={styles.description}>{policyText(model.policy, label)}</p>
      {total > 1 && (
        <Field label={T.forma} hint={T.pistaForma[shape.kind]}>
          {(id) => (
            <Select<ShapeKind>
              id={id}
              value={shape.kind}
              options={SHAPE_KINDS.map((kind) => {
                const disabled = total < SHAPE_MIN_KEYS[kind];
                return { value: kind, label: disabled ? `${T.formas[kind]} (${T.necesitaKeys(SHAPE_MIN_KEYS[kind])})` : T.formas[kind], disabled };
              })}
              onChange={(kind) => set(convertShape(shape, kind))}
            />
          )}
        </Field>
      )}
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
        <>
          <Wait blocks={shape.blocks} onChange={(blocks) => set(setShapeBlocks(shape, blocks), 'policy:blocks')} />
          <Renewal model={model} blocks={shape.blocks} onChange={(days) => apply((m) => setRenewal(m, days), 'renewal')} />
        </>
      )}
    </Section>
  );
}

/** La espera, en días o meses (se guarda en bloques). */
function Wait({ blocks, onChange }: { blocks: number; onChange(blocks: number): void }) {
  const [chosen, setUnit] = useState<Unit | null>(null);
  // Si la espera no cabe en meses enteros, se muestra en días.
  const unit = chosen === 'months' && blocks % MONTH !== 0 ? 'days' : (chosen ?? naturalUnit(blocks));
  const per = unit === 'months' ? MONTH : BLOCKS_PER_DAY;
  const value = Math.max(1, Math.round(blocks / per));
  return (
    <Field label={T.espera} hint={T.pistaEspera(blocks)}>
      {(id) => (
        <span className={styles.inline}>
          <NumberInput id={id} value={value} min={1} max={MAX[unit]} onChange={(v) => v !== undefined && onChange(v * per)} />
          <Select<Unit>
            value={unit}
            options={(['days', 'months'] as const).map((u) => ({ value: u, label: T.unidades[u] }))}
            onChange={(u) => {
              setUnit(u);
              // Al pasar a meses, se redondea a meses enteros.
              if (u === 'months') onChange(Math.min(MAX.months, Math.max(1, Math.round(blocks / MONTH))) * MONTH);
            }}
          />
        </span>
      )}
    </Field>
  );
}

/** Cada cuántos días mueve el titular las monedas. */
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
