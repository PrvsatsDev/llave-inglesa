import { indexModel, type CustodyModel, type Id } from '@llave-inglesa/domain';
import {
  ATTACK_EFFORT,
  cutScore,
  DURESS_SURCHARGE,
  explain,
  EXPOSURE,
  inheritanceScore,
  lockoutPenalty,
  ownerDeaths,
  resilienceBreakdown,
  securityBreakdown,
  simulateInheritance,
  simulateSigning,
  usabilityScore,
  type Analysis as EngineAnalysis,
  type Derivation,
} from '@llave-inglesa/engine';
import { ChevronRight, Flame, Loader2, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { ATTACK_KIND_TEXT, inheritanceText, plural } from '../lib/text.ts';
import { useAnalysis } from '../store/analysis.ts';
import { useNavigation, type MetricId } from '../store/navigation.ts';
import { useSelection } from '../store/selection.ts';
import { LossRoutes, TheftRoutes } from './Findings.tsx';
import { Button, Section } from './inspector/fields.tsx';
import { Tree } from './ScenarioPanel.tsx';
import { level } from './Scoreboard.tsx';
import tree from './ScenarioPanel.module.css';
import styles from './Analysis.module.css';

const num = (n: number) => n.toLocaleString('es');

/** Una línea del desglose: de dónde sale la base y qué se le resta. */
interface Row {
  label: string;
  points: number;
}

/** Sección Análisis › métrica: la puntuación con su desglose y, debajo, lo que la explica. */
export function MetricAnalysis({ model, metric }: { model: CustodyModel; metric: MetricId }) {
  const analysis = useAnalysis((s) => s.analysis);
  const status = useAnalysis((s) => s.status);
  if (!analysis) {
    return (
      <Section>
        <p className={styles.muted}>
          {status === 'invalid' ? (
            'Corrige los errores del esquema para ver el análisis.'
          ) : (
            <>
              <Loader2 size={14} className={styles.spin} aria-hidden /> Analizando…
            </>
          )}
        </p>
      </Section>
    );
  }
  switch (metric) {
    case 'security':
      return (
        <>
          <Score {...securityScore(analysis)} />
          <TheftRoutes model={model} />
        </>
      );
    case 'resilience':
      return (
        <>
          <Score {...resilienceScore(analysis)} />
          <LossRoutes model={model} />
        </>
      );
    case 'usability':
      return (
        <>
          <Score {...usabilityScoreRows(analysis)} />
          <Usability model={model} analysis={analysis} />
        </>
      );
    case 'inheritance':
      return (
        <>
          <Score {...inheritanceScoreRows(analysis)} />
          <Inheritance model={model} analysis={analysis} />
        </>
      );
  }
}

/** Número, estado (icono + texto), desglose y, plegado, cómo se calcula. */
function Score({ score, rows, how }: { score: number; rows: Row[]; how: string[] }) {
  const { level: lvl, icon: Icon, text } = level(score);
  const shown = rows.reduce((sum, r) => sum + r.points, 0);
  // La seguridad tiene un suelo (robar siempre cuesta algo): si se aplica, se ve como una línea más.
  const all = shown === score ? rows : [...rows, { label: 'Mínimo mientras robar cueste algo', points: score - shown }];
  return (
    <Section title="Puntuación">
      <div className={`${styles.score} ${styles[lvl]}`}>
        <span className={styles.value}>{score}</span>
        <span className={styles.status}>
          <Icon size={14} aria-hidden /> {text}
        </span>
      </div>
      <table className={styles.breakdown}>
        <tbody>
          {all.map((r, i) => (
            <tr key={i}>
              <td>{r.label}</td>
              <td className={styles.points}>{i === 0 ? r.points : `${r.points > 0 ? '+' : '−'}${Math.abs(r.points)}`}</td>
            </tr>
          ))}
        </tbody>
        {all.length > 1 && (
          <tfoot>
            <tr>
              <td>Total</td>
              <td className={styles.points}>{score}</td>
            </tr>
          </tfoot>
        )}
      </table>
      <details className={styles.how}>
        <summary>Cómo se calcula</summary>
        {how.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </details>
    </Section>
  );
}

const scale = (f: (n: number) => number, unit: [string, string], from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)
    .map((n) => `${n === to ? `${n} o más` : plural(n, ...unit)} → ${f(n)}`)
    .join(' · ');

function securityScore(a: EngineAnalysis) {
  const sec = a.security;
  const b = securityBreakdown(sec.minEffort, sec.cheapRoutes);
  const rows: Row[] =
    sec.minEffort === null
      ? [{ label: `Ningún robo con hasta ${sec.searchedUpTo} ataques a la vez`, points: b.base }]
      : [
          { label: `Robo más barato: esfuerzo ${num(sec.minEffort)}`, points: b.base },
          ...b.penalties.map((p) => ({
            label: `${sec.cheapRoutes} vías casi igual de baratas (esfuerzo ≤ ${num(sec.minEffort! + EXPOSURE.margin)})`,
            points: -p.points,
          })),
        ];
  const efforts = (Object.entries(ATTACK_EFFORT) as [keyof typeof ATTACK_EFFORT, number][])
    .sort((x, y) => x[1] - y[1])
    .map(([type, e]) => `${ATTACK_KIND_TEXT[type]} ${num(e)}`)
    .join(' · ');
  const curve = [1.5, 2, 3, 4, 5, 6].map((e) => `${num(e)}${e === 6 ? ' o más' : ''} → ${securityBreakdown(e, 1).base}`).join(' · ');
  return {
    score: sec.score,
    rows,
    how: [
      `Se buscan todas las combinaciones de hasta ${sec.searchedUpTo} ataques que permiten gastar. Cada ataque suma su esfuerzo: ${efforts}. Si hay que vencer un PIN de coacción, +${num(DURESS_SURCHARGE)}.`,
      `Cuanto más esfuerzo exige el robo más barato, más puntuación: ${curve}.`,
      `Tener varias vías casi igual de baratas (hasta ${num(EXPOSURE.margin)} más de esfuerzo) resta ${EXPOSURE.penaltyPerExtraRoute} por cada vía extra, como mucho ${EXPOSURE.maxPenalty}.`,
    ],
  };
}

function resilienceScore(a: EngineAnalysis) {
  const res = a.resilience;
  if (!res.recoverableNow) {
    return { score: res.score, rows: [{ label: 'Ahora mismo nadie puede recuperar los fondos', points: 0 }], how: [] as string[] };
  }
  const b = resilienceBreakdown(res.minSize, res.lockoutMinSize);
  const rows: Row[] = [
    res.minSize === null
      ? { label: `Ninguna combinación de hasta ${res.searchedUpTo} desgracias lo pierde todo`, points: b.base }
      : { label: `Se pierde todo con ${plural(res.minSize, 'desgracia', 'desgracias a la vez')}`, points: b.base },
    ...b.penalties.map((p) => ({ label: `Bloqueo temporal con ${plural(res.lockoutMinSize!, 'suceso', 'sucesos a la vez')}`, points: -p.points })),
  ];
  return {
    score: res.score,
    rows,
    how: [
      `Se buscan las combinaciones de hasta ${res.searchedUpTo} desgracias (incendio, pérdida, fallecimiento, olvido…) tras las que nadie podría recuperar los fondos nunca. Cuantas más tienen que ocurrir a la vez, más puntuación: ${[1, 2, 3].map((n) => `${plural(n, 'desgracia', 'desgracias')} → ${cutScore(n)}`).join(' · ')} · ninguna → ${cutScore(null)}.`,
      `Un bloqueo temporal (fondos inmovilizados mientras alguien está incapacitado) no pierde nada, pero resta: con 1 suceso −${lockoutPenalty(1)}, con 2 a la vez −${lockoutPenalty(2)}.`,
    ],
  };
}

function usabilityScoreRows(a: EngineAnalysis) {
  const n = a.usability.locations?.length ?? null;
  return {
    score: a.usability.score,
    rows: [{ label: n === null ? 'Los titulares no pueden firmar de forma segura' : `Firmar exige ir a ${plural(n, 'ubicación', 'ubicaciones')}`, points: a.usability.score }],
    how: [
      'Cuántas ubicaciones tienen que visitar los titulares para firmar de forma segura: con dispositivos de firma, sin teclear ninguna semilla en un ordenador.',
      `${scale(usabilityScore, ['ubicación', 'ubicaciones'], 1, 4)}.`,
    ],
  };
}

function inheritanceScoreRows(a: EngineAnalysis) {
  const inh = a.inheritance;
  const label =
    inh.status === 'ok'
      ? `${inh.heirs.length > 0 ? 'Los herederos recuperan' : 'Se recupera'} yendo a ${plural(inh.locations!.length, 'ubicación', 'ubicaciones')}`
      : inh.status === 'no-heirs'
        ? 'No hay herederos'
        : 'Los herederos no pueden recuperar los fondos';
  return {
    score: inh.score,
    rows: [{ label, points: inh.score }],
    how: [
      'Tras el fallecimiento de todos los titulares, si los herederos pueden recuperar los fondos con lo que tienen a su alcance (incluidos los accesos "tras fallecer"), y cuántas ubicaciones les cuesta.',
      `${scale(inheritanceScore, ['ubicación', 'ubicaciones'], 1, 4)}.`,
    ],
  };
}

/** Lista de ubicaciones pulsables (abren su ficha). */
function Places({ model, ids }: { model: CustodyModel; ids: readonly Id[] }) {
  const select = useSelection((s) => s.select);
  return (
    <ul className={styles.places}>
      {ids.map((id) => (
        <li key={id}>
          <button className={styles.place} onClick={() => select({ kind: 'location', id })}>
            <MapPin size={14} aria-hidden />
            {model.locations.find((l) => l.id === id)?.name || 'Sin nombre'}
            <ChevronRight size={14} className={styles.chevron} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** El árbol del porqué o, si no se puede gastar, con qué keys se firma y cuántas faltan. */
function Why({ model, derivation, who }: { model: CustodyModel; derivation: Derivation; who: string }) {
  const index = indexModel(model);
  const node = explain(derivation, 'spend');
  if (node) {
    return (
      <ul className={tree.tree}>
        <Tree node={node} index={index} model={model} />
      </ul>
    );
  }
  const needed = model.policy.type === 'thresh' ? model.policy.k : 1;
  const signable = [...derivation.signable].map((k) => index.label(k));
  return (
    <p className={styles.muted}>
      {who} solo consiguen firmar con <strong>{signable.length ? signable.join(', ') : 'ninguna key'}</strong>, y hacen falta {needed}.
      {derivation.signable.size >= needed && ' Tienen firmas suficientes, pero les faltan xpubs para construir la transacción (el descriptor).'}
    </p>
  );
}

function Usability({ model, analysis }: { model: CustodyModel; analysis: EngineAnalysis }) {
  const locations = analysis.usability.locations;
  const derivation = useMemo(() => simulateSigning(model, locations ?? undefined), [model, locations]);
  return (
    <>
      {locations && (
        <Section title="Dónde se firma">
          <p className={styles.muted}>Lo mínimo que tienen que visitar los titulares para firmar una transacción:</p>
          <Places model={model} ids={locations} />
        </Section>
      )}
      <Section title="Por qué">
        <Why model={model} derivation={derivation} who="Con todo lo que tienen a su alcance, los titulares" />
      </Section>
    </>
  );
}

function Inheritance({ model, analysis }: { model: CustodyModel; analysis: EngineAnalysis }) {
  const inh = analysis.inheritance;
  const simulate = useNavigation((s) => s.simulate);
  const people = useMemo(() => [...inh.heirs, ...inh.helpers], [inh.heirs, inh.helpers]);
  const derivation = useMemo(
    () => simulateInheritance(model, inh.locations ?? undefined, inh.status === 'ok' ? people : undefined),
    [model, inh.locations, inh.status, people],
  );

  if (inh.status === 'no-heirs') {
    return (
      <Section title="Herederos">
        <p className={styles.muted}>
          Nadie más que los titulares puede llegar a los fondos. Para modelar la herencia, marca a una persona como heredera en su ficha
          (Esquema › Personas) y dale acceso a alguna ubicación, por ejemplo "tras fallecer" el titular.
        </p>
      </Section>
    );
  }
  return (
    <>
      <Section title="Herederos">
        <p className={styles.muted}>
          Tras el fallecimiento de los titulares, {inheritanceText(inh, model.people)}
          {inh.status === 'ok' ? ', yendo a:' : '.'}
        </p>
        {inh.locations && <Places model={model} ids={inh.locations} />}
        <Button icon={Flame} onClick={() => simulate({ kind: 'loss', events: ownerDeaths(model) }, 'inheritance')}>
          Simular el fallecimiento en el mapa
        </Button>
      </Section>
      <Section title="Por qué">
        <Why model={model} derivation={derivation} who={inh.status === 'ok' ? 'Los herederos' : 'Con todo lo que tienen a su alcance, quienes quedan'} />
      </Section>
    </>
  );
}
