import { indexModel, type CustodyModel } from '@llave-inglesa/domain';
import { attackAtoms, createWorld, lossAtoms, ownerDeaths, type LossEvent } from '@llave-inglesa/engine';
import { ChevronDown, ChevronUp, Flame, Hourglass, Info, Play, ShieldCheck, Skull } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { attackText, duressText, lossText } from '../lib/text.ts';
import type { Scenario } from '../scenario/view.ts';
import { useAnalysis } from '../store/analysis.ts';
import { useNavigation, type MetricId } from '../store/navigation.ts';
import { sameScenario, useScenario } from '../store/scenario.ts';
import { Field, Section, Select } from './inspector/fields.tsx';
import styles from './Findings.module.css';

const MAX_SHOWN = 5;

const atOnce = (cut: readonly unknown[]) => (cut.length === 1 ? '1 suceso' : `${cut.length} a la vez`);

/**
 * Combinaciones: primero las que marcan la puntuación (`cuts`, como mucho MAX_SHOWN) y,
 * al desplegar, todas las de `all` en su orden, con `restTitle` antes de las demás.
 */
function CutList<A>({ cuts, all, text, meta, empty, restTitle, tone = 'danger', toScenario, from }: {
  cuts: A[][];
  all: A[][];
  text(a: A): string;
  meta(cut: A[]): ReactNode;
  empty: string;
  restTitle: string;
  tone?: 'danger' | 'warn';
  toScenario(cut: A[]): Scenario;
  /** Métrica a la que vuelve "volver" desde la simulación. */
  from: MetricId;
}) {
  const active = useScenario((s) => s.active);
  const simulate = useNavigation((s) => s.simulate);
  const [expanded, setExpanded] = useState(false);
  if (cuts.length === 0) return <p className={styles.empty}>{empty}</p>;
  const main = new Set(cuts);
  const shown = cuts.slice(0, MAX_SHOWN);
  const hidden = all.length - shown.length;
  const visible = expanded ? all : shown;
  const firstRest = visible.findIndex((cut) => !main.has(cut));
  return (
    <>
      <ul className={styles.list}>
        {visible.map((cut, i) => {
          const scenario = toScenario(cut);
          const on = sameScenario(active, scenario);
          return (
            <li key={i}>
              {i === firstRest && <p className={styles.restTitle}>{restTitle}</p>}
              <button
                className={`${styles.cut} ${styles[tone]} ${on ? styles.active : ''}`}
                onClick={() => simulate(scenario, from, all.map(toScenario))}
                aria-current={on || undefined}
                title="Simular en el mapa"
              >
                {cut.map((atom, j) => (
                  <span key={j} className={styles.atomWrap}>
                    {j > 0 && <span className={styles.plus}>+</span>}
                    <span className={styles.atom}>{text(atom)}</span>
                  </span>
                ))}
                <span className={styles.meta}>{meta(cut)}</span>
                <Play size={12} className={styles.play} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {hidden > 0 && (
        <button className={styles.more} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
          {expanded ? 'Ocultar las demás' : `Ver las ${hidden} restantes`}
        </button>
      )}
    </>
  );
}

/** Lanza cualquier ataque o desgracia individual (luego se pueden combinar en el panel). */
export function TryScenario({ model }: { model: CustodyModel }) {
  const simulate = useNavigation((s) => s.simulate);
  const index = indexModel(model);
  const world = createWorld(model);
  const attacks = attackAtoms(world);
  const losses = lossAtoms(world);
  return (
    <Section title="Empezar con un suceso">
      <Field label="Un ataque">
        {(id) => (
          <Select
            id={id}
            value=""
            options={[{ value: '', label: 'Elige un ataque…' }, ...attacks.map((a, i) => ({ value: String(i), label: attackText(a, index) }))]}
            onChange={(v) => v !== '' && simulate({ kind: 'attack', atoms: [attacks[Number(v)]!] })}
          />
        )}
      </Field>
      <Field label="Una desgracia">
        {(id) => (
          <Select
            id={id}
            value=""
            options={[{ value: '', label: 'Elige una desgracia…' }, ...losses.map((e, i) => ({ value: String(i), label: lossText(e, index) }))]}
            onChange={(v) => v !== '' && simulate({ kind: 'loss', events: [losses[Number(v)]!] })}
          />
        )}
      </Field>
    </Section>
  );
}

/** Formas más baratas de robar. Cada una se puede simular en el mapa. */
export function TheftRoutes({ model }: { model: CustodyModel }) {
  const analysis = useAnalysis((s) => s.analysis);
  if (!analysis) return null;
  const index = indexModel(model);
  const { security } = analysis;
  // Las vías "casi igual de baratas" también cuentan para la puntuación: se muestran todas.
  const cheapThefts = security.minEffort === null ? [] : security.cuts.slice(0, security.cheapRoutes);
  const route = new Map(security.cuts.map((cut, i) => [cut, { effort: security.efforts[i]!, duress: security.beatsDuress[i]! }]));
  const theftMeta = (cut: (typeof security.cuts)[number]) => {
    const r = route.get(cut)!;
    return `esfuerzo ${r.effort.toLocaleString('es')}${r.duress ? ' · vence un PIN de coacción' : ''}`;
  };

  return (
    <Section title="Formas más baratas de robar">
      <div className={styles.header}>
        <Skull size={14} aria-hidden />
        <span>Cualquiera de estas combinaciones basta para gastar tus fondos. Pulsa una para verla en el mapa.</span>
      </div>
      <CutList
        cuts={cheapThefts}
        all={security.cuts}
        text={(a) => attackText(a, index)}
        meta={theftMeta}
        empty={`Ninguna combinación de hasta ${security.searchedUpTo} ataques lo consigue.`}
        restTitle="Más costosas"
        toScenario={(atoms) => ({ kind: 'attack', atoms })}
        from="security"
      />
    </Section>
  );
}

/**
 * Qué aporta cada PIN de coacción a la seguridad y, si no aporta nada, por qué (con la vía que
 * lo esquiva, simulable). Con `device`, solo el de ese dispositivo (para su ficha).
 */
export function DuressNotes({ model, device }: { model: CustodyModel; device?: string }) {
  const analysis = useAnalysis((s) => s.analysis);
  const simulate = useNavigation((s) => s.simulate);
  if (!analysis) return null;
  const index = indexModel(model);
  const reports = analysis.duress.filter((r) => (device === undefined || r.device === device) && index.devices.has(r.device));
  if (reports.length === 0) return null;
  return (
    <ul className={styles.list}>
      {reports.map((r) => {
        const Icon = r.helps ? ShieldCheck : Info;
        const bypass = r.bypass;
        return (
          <li key={r.device} className={`${styles.note} ${r.helps ? styles.noteHelps : ''}`}>
            <Icon size={14} aria-hidden />
            <span>
              {duressText(r, analysis.security, index)}
              {bypass && (
                <>
                  {' '}
                  <button className={styles.noteLink} onClick={() => simulate({ kind: 'attack', atoms: bypass }, device ? undefined : 'security')}>
                    <Play size={11} aria-hidden /> Ver en el mapa
                  </button>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Formas más baratas de perderlo todo y bloqueos temporales. */
export function LossRoutes({ model }: { model: CustodyModel }) {
  const analysis = useAnalysis((s) => s.analysis);
  if (!analysis) return null;
  const index = indexModel(model);
  const { resilience } = analysis;
  const rarity = new Map([
    ...resilience.cuts.map((cut, i) => [cut, resilience.rarities[i]!] as const),
    ...resilience.lockouts.map((cut, i) => [cut, resilience.lockoutRarities[i]!] as const),
  ]);
  const lossMeta = (cut: LossEvent[]) => `rareza ${rarity.get(cut)!.toLocaleString('es')} · ${atOnce(cut)}`;

  return (
    <>
      <Section title="Formas más probables de perderlo todo">
        <div className={styles.header}>
          <Flame size={14} aria-hidden />
          <span>Tras cualquiera de estas, nadie podría recuperar los fondos. Pulsa una para verla en el mapa.</span>
        </div>
        {resilience.recoverableNow ? (
          <CutList
            cuts={resilience.cheapest}
            all={resilience.cuts}
            text={(e) => lossText(e, index)}
            meta={lossMeta}
            empty={`Ninguna combinación de hasta ${resilience.searchedUpTo} desgracias lo consigue.`}
            restTitle="Menos probables"
            toScenario={(events) => ({ kind: 'loss', events })}
            from="resilience"
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
            cuts={resilience.lockouts.filter((_, i) => resilience.lockoutRarities[i] === resilience.lockoutMinRarity)}
            all={resilience.lockouts}
            text={(e) => lossText(e, index)}
            meta={lossMeta}
            empty=""
            restTitle="Menos probables"
            tone="warn"
            toScenario={(events) => ({ kind: 'loss', events })}
            from="resilience"
          />
        </Section>
      )}
    </>
  );
}

/** Lo que, además del fallecimiento de los titulares, dejaría a los herederos sin los fondos. */
export function HeirLossRoutes({ model }: { model: CustodyModel }) {
  const analysis = useAnalysis((s) => s.analysis);
  if (!analysis) return null;
  const index = indexModel(model);
  const { inheritance: inh } = analysis;
  const rarity = new Map(inh.losses.map((cut, i) => [cut, inh.lossRarities[i]!] as const));
  const deaths = ownerDeaths(model);
  return (
    <Section title="Formas más probables de quedarse sin herencia">
      <div className={styles.header}>
        <Flame size={14} aria-hidden />
        <span>Si además del fallecimiento pasa cualquiera de estas, los herederos no podrían recuperar los fondos. Pulsa una para verla en el mapa.</span>
      </div>
      <CutList
        cuts={inh.losses.filter((_, i) => inh.lossRarities[i] === inh.lossRarities[0])}
        all={inh.losses}
        text={(e) => lossText(e, index)}
        meta={(cut) => `rareza ${rarity.get(cut)!.toLocaleString('es')} · ${atOnce(cut)}`}
        empty={`Ninguna combinación de hasta ${analysis.resilience.searchedUpTo} desgracias lo consigue.`}
        restTitle="Menos probables"
        tone="warn"
        toScenario={(events) => ({ kind: 'loss', events: [...deaths, ...events] })}
        from="inheritance"
      />
    </Section>
  );
}
