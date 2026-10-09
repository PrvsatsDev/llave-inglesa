import { indexModel, type CustodyModel, type ModelIndex } from '@llave-inglesa/domain';
import { atomEffort, attackAtoms, attackEffort, attackSites, createWorld, DURESS_SURCHARGE, extraSitesSurcharge, explain, lossAtoms, type AttackAtom, type ExplanationNode, type LossEvent } from '@llave-inglesa/engine';
import { Bug, Eye, EyeOff, Flame, ShieldQuestion, Skull, X } from 'lucide-react';
import { attackText, factText, lossText, ruleText, UI } from '../lib/text.ts';
import type { ScenarioView } from '../scenario/view.ts';
import { useScenario } from '../store/scenario.ts';
import { PanelHeader, Section, Select } from './inspector/fields.tsx';
import fields from './inspector/fields.module.css';
import styles from './ScenarioPanel.module.css';

const T = UI.simular;
const OUTCOME_TITLE = T.resultado;

export function Tree({ node, index, model }: { node: ExplanationNode; index: ModelIndex; model: CustodyModel }) {
  const reason = ruleText(node.justification, index, model.policy);
  return (
    <li className={styles.node}>
      <span className={`${styles.fact} ${node.fact.kind === 'spend' ? styles.root : ''}`}>{factText(node.fact, index)}</span>
      {node.repeated ? <span className={styles.reason}>{T.verArriba}</span> : reason && <span className={styles.reason}>{reason}</span>}
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
              <button className={fields.iconButton} onClick={() => onChange(steps.filter((_, j) => j !== i))} aria-label={T.quitarSuceso}>
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {remaining.length > 0 && (
        <Select
          value=""
          options={[{ value: '', label: T.anadirSuceso }, ...remaining.map((a, i) => ({ value: String(i), label: text(a) }))]}
          onChange={(v) => v !== '' && onChange([...steps, remaining[Number(v)]!])}
        />
      )}
    </>
  );
}

const num = UI.comun.numero;

/**
 * Lo que le cuesta al atacante: el esfuerzo de cada ataque, el recargo por asaltar varios sitios, el de vencer un PIN de
 * coacción (explicado) y los dispositivos que caen por firmware malicioso o extracción física.
 */
function Effort({ model, view, index }: { model: CustodyModel; view: ScenarioView; index: ModelIndex }) {
  if (view.scenario.kind !== 'attack') return null;
  const atoms = view.scenario.atoms;
  const duress = view.duress;
  const name = (id: string) => index.label(id);
  const people = T.unir([...new Set(duress.map((d) => d.person))].map(name));
  const devices = T.unir([...new Set(duress.map((d) => d.device))].map(name));
  const sites = attackSites(atoms, index);
  const sitesSurcharge = extraSitesSurcharge(atoms, index);
  return (
    <Section title={T.esfuerzo}>
      <table className={styles.effort}>
        <tbody>
          {atoms.map((a, i) => (
            <tr key={i}>
              <td>{attackText(a, index)}</td>
              <td className={styles.points}>{num(atomEffort(a, index))}</td>
            </tr>
          ))}
          {sitesSurcharge > 0 && (
            <tr>
              <td>{T.asaltar(sites.length, sites.map(name).join(', '))}</td>
              <td className={styles.points}>+{num(sitesSurcharge)}</td>
            </tr>
          )}
          {duress.length > 0 && (
            <tr>
              <td>{T.vencerCoaccion(devices)}</td>
              <td className={styles.points}>+{num(DURESS_SURCHARGE)}</td>
            </tr>
          )}
        </tbody>
        {(atoms.length > 1 || sitesSurcharge > 0 || duress.length > 0) && (
          <tfoot>
            <tr>
              <td>{T.total}</td>
              <td className={styles.points}>{num(attackEffort(atoms, index, duress.length > 0))}</td>
            </tr>
          </tfoot>
        )}
      </table>
      {duress.length > 0 && (
        <p className={styles.note}>
          <ShieldQuestion size={14} aria-hidden />
          <span>
            {T.coaccion.antes(people, duress.length > 1)} <strong>{T.coaccion.destacado}</strong> {T.coaccion.despues(devices, DURESS_SURCHARGE)}
          </span>
        </p>
      )}
      {[...view.compromised].map(([device, how]) => (
        <p key={device} className={`${styles.note} ${styles.noteDanger}`}>
          <Bug size={14} aria-hidden />
          <span>
            <strong>{name(device)}</strong>{' '}
            {how === 'firmware' ? T.comprometido.firmware(model.devices.find((d) => d.id === device)?.vendor ?? null) : T.comprometido.extraccion}
          </span>
        </p>
      ))}
    </Section>
  );
}

/** Ver no es gastar: con todas las xpubs el atacante conoce tu saldo y tu historial. */
function Privacy({ model, view, index }: { model: CustodyModel; view: ScenarioView; index: ModelIndex }) {
  const { exposed, via } = view.exposure;
  const origin = via ? explain(view.derivation, via) : null;
  return (
    <Section title={T.privacidad.titulo}>
      {exposed ? (
        <>
          <p className={`${styles.note} ${styles.noteWarn}`}>
            <Eye size={14} aria-hidden />
            <span>
              {view.outcome === 'stolen' ? T.privacidad.ademas : T.privacidad.aunque}
              {T.privacidad.antes} <strong>{T.privacidad.destacado}</strong> {T.privacidad.despues}
            </span>
          </p>
          {origin && (
            <ul className={styles.tree}>
              <Tree node={origin} index={index} model={model} />
            </ul>
          )}
        </>
      ) : (
        <p className={styles.note}>
          <EyeOff size={14} aria-hidden />
          <span>{T.privacidad.noVe}</span>
        </p>
      )}
    </Section>
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
      <PanelHeader icon={scenario.kind === 'attack' ? Skull : Flame} kind={T.simulacion} title={OUTCOME_TITLE[view.outcome]} onClose={() => setScenario(null)} closeLabel={T.salir} />

      <Section title={scenario.kind === 'attack' ? T.ataques : T.desgracias}>
        {scenario.kind === 'attack' ? (
          <Steps<AttackAtom>
            steps={scenario.atoms}
            all={attackAtoms(world)}
            text={(a) => attackText(a, index)}
            onChange={(atoms) => setScenario({ kind: 'attack', atoms })}
          />
        ) : (
          <Steps<LossEvent>
            steps={scenario.events}
            all={lossAtoms(world)}
            text={(e) => lossText(e, index)}
            onChange={(events) => setScenario({ kind: 'loss', events })}
          />
        )}
      </Section>

      <Effort model={model} view={view} index={index} />

      {scenario.kind === 'attack' && <Privacy model={model} view={view} index={index} />}

      <Section title={T.porQue}>
        {view.explanation ? (
          <ul className={styles.tree}>
            <Tree node={view.explanation} index={index} model={model} />
          </ul>
        ) : (
          <p className={styles.summary}>
            {scenario.kind === 'attack' ? T.elAtacante : T.quienQueda} {T.soloFirma}{' '}
            <strong>{signable.length ? signable.join(', ') : T.ningunaKey}</strong>
            {T.hacenFalta(needed)}
            {view.outcome === 'lockout' && T.trasIncapacidad}
            {derivation.signable.size >= needed && T.faltanXpubs}
          </p>
        )}
      </Section>
    </>
  );
}
