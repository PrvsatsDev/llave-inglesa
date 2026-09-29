import { indexModel, type CustodyModel } from '@llave-inglesa/domain';
import { attackAtoms, attackEffort, createWorld, lossAtoms } from '@llave-inglesa/engine';
import { Flame, Hourglass, Play, Skull } from 'lucide-react';
import type { ReactNode } from 'react';
import { attackText, lossText } from '../lib/text.ts';
import type { Scenario } from '../scenario/view.ts';
import { useAnalysis } from '../store/analysis.ts';
import { sameScenario, useScenario } from '../store/scenario.ts';
import { Field, Section, Select } from './inspector/fields.tsx';
import styles from './Findings.module.css';

const MAX_SHOWN = 5;

function CutList<A>({ cuts, total, text, meta, empty, tone = 'danger', toScenario }: {
  cuts: A[][];
  total: number;
  text(a: A): string;
  meta?(cut: A[]): ReactNode;
  empty: string;
  tone?: 'danger' | 'warn';
  toScenario(cut: A[]): Scenario;
}) {
  const active = useScenario((s) => s.active);
  const setScenario = useScenario((s) => s.set);
  if (cuts.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <>
      <ul className={styles.list}>
        {cuts.slice(0, MAX_SHOWN).map((cut, i) => {
          const scenario = toScenario(cut);
          const on = sameScenario(active, scenario);
          return (
            <li key={i}>
              <button
                className={`${styles.cut} ${styles[tone]} ${on ? styles.active : ''}`}
                onClick={() => setScenario(on ? null : scenario)}
                aria-pressed={on}
                title="Simular en el mapa"
              >
                {cut.map((atom, j) => (
                  <span key={j} className={styles.atomWrap}>
                    {j > 0 && <span className={styles.plus}>+</span>}
                    <span className={styles.atom}>{text(atom)}</span>
                  </span>
                ))}
                {meta && <span className={styles.meta}>{meta(cut)}</span>}
                <Play size={12} className={styles.play} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {total > MAX_SHOWN && <p className={styles.more}>{total} combinaciones mínimas en total</p>}
    </>
  );
}

/** Lanza cualquier ataque o desgracia individual (luego se pueden combinar en el panel). */
function TryScenario({ model }: { model: CustodyModel }) {
  const setScenario = useScenario((s) => s.set);
  const label = indexModel(model).label;
  const world = createWorld(model);
  const attacks = attackAtoms(world);
  const losses = lossAtoms(world);
  return (
    <Section title="Probar un escenario">
      <Field label="Un ataque">
        {(id) => (
          <Select
            id={id}
            value=""
            options={[{ value: '', label: 'Elige un ataque…' }, ...attacks.map((a, i) => ({ value: String(i), label: attackText(a, label) }))]}
            onChange={(v) => v !== '' && setScenario({ kind: 'attack', atoms: [attacks[Number(v)]!] })}
          />
        )}
      </Field>
      <Field label="Una desgracia">
        {(id) => (
          <Select
            id={id}
            value=""
            options={[{ value: '', label: 'Elige una desgracia…' }, ...losses.map((e, i) => ({ value: String(i), label: lossText(e, label) }))]}
            onChange={(v) => v !== '' && setScenario({ kind: 'loss', events: [losses[Number(v)]!] })}
          />
        )}
      </Field>
    </Section>
  );
}

/** Los puntos débiles que ha encontrado el análisis. Cada uno se puede simular en el mapa. */
export function Findings({ model }: { model: CustodyModel }) {
  const analysis = useAnalysis((s) => s.analysis);
  if (!analysis) return null;
  const label = indexModel(model).label;
  const { security, resilience } = analysis;
  // Las vías "casi igual de baratas" también cuentan para la puntuación: se muestran todas.
  const cheapThefts = security.minEffort === null ? [] : security.cuts.slice(0, security.cheapRoutes);

  return (
    <>
      <Section title="Formas más baratas de robar">
        <div className={styles.header}>
          <Skull size={14} aria-hidden />
          <span>Cualquiera de estas combinaciones basta para gastar tus fondos. Pulsa una para verla en el mapa.</span>
        </div>
        <CutList
          cuts={cheapThefts}
          total={security.cuts.length}
          text={(a) => attackText(a, label)}
          meta={(cut) => `esfuerzo ${attackEffort(cut).toLocaleString('es')}`}
          empty={`Ninguna combinación de hasta ${security.searchedUpTo} ataques lo consigue.`}
          toScenario={(atoms) => ({ kind: 'attack', atoms })}
        />
      </Section>
      <Section title="Formas más baratas de perderlo todo">
        <div className={styles.header}>
          <Flame size={14} aria-hidden />
          <span>Tras cualquiera de estas, nadie podría recuperar los fondos</span>
        </div>
        {resilience.recoverableNow ? (
          <CutList
            cuts={resilience.cheapest}
            total={resilience.cuts.length}
            text={(e) => lossText(e, label)}
            empty={`Ninguna combinación de hasta ${resilience.searchedUpTo} desgracias lo consigue.`}
            toScenario={(events) => ({ kind: 'loss', events })}
          />
        ) : (
          <p className={styles.critical}>Ya ahora mismo nadie puede recuperar los fondos.</p>
        )}
      </Section>
      {resilience.lockouts.length > 0 && (
        <Section title="Bloqueos temporales">
          <div className={styles.header}>
            <Hourglass size={14} aria-hidden />
            <span>Los fondos quedarían inmovilizados mientras dure la incapacidad; se recuperan tras el fallecimiento.</span>
          </div>
          <CutList
            cuts={resilience.lockouts.filter((c) => c.length === resilience.lockoutMinSize)}
            total={resilience.lockouts.length}
            text={(e) => lossText(e, label)}
            empty=""
            tone="warn"
            toScenario={(events) => ({ kind: 'loss', events })}
          />
        </Section>
      )}
      <TryScenario model={model} />
    </>
  );
}
