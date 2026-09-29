import { indexModel, type CustodyModel, type ModelIndex } from '@llave-inglesa/domain';
import { attackAtoms, createWorld, lossAtoms, type AttackAtom, type ExplanationNode, type LossEvent } from '@llave-inglesa/engine';
import { Flame, Skull, X } from 'lucide-react';
import { attackText, factText, lossText, ruleText } from '../lib/text.ts';
import type { ScenarioView } from '../scenario/view.ts';
import { useScenario } from '../store/scenario.ts';
import { PanelHeader, Section, Select } from './inspector/fields.tsx';
import fields from './inspector/fields.module.css';
import styles from './ScenarioPanel.module.css';

const OUTCOME_TITLE = {
  stolen: 'Robo posible',
  safe: 'El atacante no llega',
  recoverable: 'Fondos recuperables',
  lockout: 'Bloqueo temporal',
  lost: 'Pérdida permanente',
} as const;

function Tree({ node, index, model }: { node: ExplanationNode; index: ModelIndex; model: CustodyModel }) {
  const reason = ruleText(node.justification, index, model.policy);
  return (
    <li className={styles.node}>
      <span className={`${styles.fact} ${node.fact.kind === 'spend' ? styles.root : ''}`}>{factText(node.fact, index)}</span>
      {node.repeated ? <span className={styles.reason}>(ver arriba)</span> : reason && <span className={styles.reason}>{reason}</span>}
      {!node.repeated && node.children.length > 0 && (
        <ul className={styles.children}>
          {node.children.map((c) => (
            <Tree key={c.id} node={c} index={index} model={model} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Sucesos del escenario: se pueden quitar y añadir para componer escenarios propios. */
function Steps<A>({ steps, all, text, onChange }: { steps: A[]; all: A[]; text(a: A): string; onChange(steps: A[]): void }) {
  const key = (a: A) => JSON.stringify(a);
  const remaining = all.filter((a) => !steps.some((s) => key(s) === key(a)));
  return (
    <>
      <ul className={fields.list}>
        {steps.map((s, i) => (
          <li key={key(s)} className={fields.row}>
            <span className={fields.rowGrow}>{text(s)}</span>
            {steps.length > 1 && (
              <button className={fields.iconButton} onClick={() => onChange(steps.filter((_, j) => j !== i))} aria-label="Quitar suceso">
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {remaining.length > 0 && (
        <Select
          value=""
          options={[{ value: '', label: '+ Añadir otro suceso a la vez…' }, ...remaining.map((a, i) => ({ value: String(i), label: text(a) }))]}
          onChange={(v) => v !== '' && onChange([...steps, remaining[Number(v)]!])}
        />
      )}
    </>
  );
}

export function ScenarioPanel({ model, view }: { model: CustodyModel; view: ScenarioView }) {
  const setScenario = useScenario((s) => s.set);
  const index = indexModel(model);
  const world = createWorld(model);
  const { scenario, derivation } = view;
  const needed = model.policy.type === 'thresh' ? model.policy.k : 1;
  const signable = [...derivation.signable].map((k) => index.label(k));

  return (
    <>
      <PanelHeader icon={scenario.kind === 'attack' ? Skull : Flame} kind="Simulación" title={OUTCOME_TITLE[view.outcome]} onClose={() => setScenario(null)} />

      <Section title={scenario.kind === 'attack' ? 'Ataques combinados' : 'Desgracias combinadas'}>
        {scenario.kind === 'attack' ? (
          <Steps<AttackAtom>
            steps={scenario.atoms}
            all={attackAtoms(world)}
            text={(a) => attackText(a, index.label)}
            onChange={(atoms) => setScenario({ kind: 'attack', atoms })}
          />
        ) : (
          <Steps<LossEvent>
            steps={scenario.events}
            all={lossAtoms(world)}
            text={(e) => lossText(e, index.label)}
            onChange={(events) => setScenario({ kind: 'loss', events })}
          />
        )}
      </Section>

      <Section title="Por qué">
        {view.explanation ? (
          <ul className={styles.tree}>
            <Tree node={view.explanation} index={index} model={model} />
          </ul>
        ) : (
          <p className={styles.summary}>
            {scenario.kind === 'attack' ? 'El atacante' : 'Quien queda'} solo consigue firmar con{' '}
            <strong>{signable.length ? signable.join(', ') : 'ninguna key'}</strong>, y hacen falta {needed}.
            {view.outcome === 'lockout' && ' Cuando las personas incapacitadas fallezcan, los herederos podrán acceder a lo que falta.'}
            {derivation.signable.size >= needed && ' Tiene suficientes firmas, pero le faltan xpubs para construir la transacción (el descriptor).'}
          </p>
        )}
      </Section>
    </>
  );
}
