import { indexModel, type CustodyModel, type Id } from '@llave-inglesa/domain';
import {
  explain,
  EXPOSURE,
  inheritanceBreakdown,
  inheritanceLetter,
  ownerDeaths,
  resilienceBreakdown,
  securityBreakdown,
  simulateInheritance,
  simulateSigning,
  type Analysis as EngineAnalysis,
  type Derivation,
} from '@llave-inglesa/engine';
import { ChevronRight, Flame, Loader2, Mail, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { inheritanceText, UI } from '../lib/text.ts';
import { useAnalysis } from '../store/analysis.ts';
import { useNavigation, type MetricId } from '../store/navigation.ts';
import { useSelection } from '../store/selection.ts';
import { DuressNotes, HeirLossRoutes, LossRoutes, TheftRoutes } from './Findings.tsx';
import { InheritanceLetterSheet } from './InheritanceLetterSheet.tsx';
import { Button, Section } from './inspector/fields.tsx';
import { Tree } from './ScenarioPanel.tsx';
import { level } from './Scoreboard.tsx';
import tree from './ScenarioPanel.module.css';
import styles from './Analysis.module.css';

const T = UI.analisis;
const round1 = (n: number) => Math.round(n * 10) / 10;

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
            T.corrigeErrores
          ) : (
            <>
              <Loader2 size={14} className={styles.spin} aria-hidden /> {T.analizando}
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
          {analysis.duress.length > 0 && (
            <Section title={T.coaccion}>
              <DuressNotes model={model} />
            </Section>
          )}
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
  const all = shown === score ? rows : [...rows, { label: T.minimo, points: score - shown }];
  return (
    <Section title={T.puntuacion}>
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
              <td>{T.total}</td>
              <td className={styles.points}>{score}</td>
            </tr>
          </tfoot>
        )}
      </table>
      <details className={styles.how}>
        <summary>{T.comoSeCalcula}</summary>
        {how.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </details>
    </Section>
  );
}

function securityScore(a: EngineAnalysis) {
  const sec = a.security;
  const b = securityBreakdown(sec.minEffort, sec.cheapRoutes);
  const rows: Row[] =
    sec.minEffort === null
      ? [{ label: T.seguridad.sinRobo(sec.searchedUpTo), points: b.base }]
      : [
          { label: T.seguridad.roboMasBarato(sec.minEffort), points: b.base },
          ...b.penalties.map((p) => ({ label: T.seguridad.viasBaratas(sec.cheapRoutes, sec.minEffort! + EXPOSURE.margin), points: -p.points })),
        ];
  return {
    score: sec.score,
    rows,
    how: T.seguridad.como(sec.searchedUpTo),
  };
}

function resilienceScore(a: EngineAnalysis) {
  const res = a.resilience;
  if (!res.recoverableNow) {
    return { score: res.score, rows: [{ label: T.resiliencia.nadiePuede, points: 0 }], how: [] as string[] };
  }
  const b = resilienceBreakdown(res.minRarity, res.combinedRarity, res.lockoutMinRarity, res.noDescriptorCopy);
  const label = (reason: string, points: number): Row =>
    reason === 'other-routes'
      ? { label: T.resiliencia.otrasVias(res.cuts.length - 1, round1(res.combinedRarity!)), points: -points }
      : reason === 'no-descriptor'
        ? { label: T.resiliencia.sinDescriptor, points: -points }
        : { label: T.resiliencia.bloqueo(res.lockoutMinRarity!), points: -points };
  const rows: Row[] = [
    res.minRarity === null
      ? { label: T.resiliencia.sinPerdida(res.searchedUpTo), points: b.base }
      : { label: T.resiliencia.perdidaMasProbable(res.minRarity), points: b.base },
    ...b.penalties.map((p) => label(p.reason, p.points)),
  ];
  return {
    score: res.score,
    rows,
    how: T.resiliencia.como(res.searchedUpTo),
  };
}

function usabilityScoreRows(a: EngineAnalysis) {
  const n = a.usability.visits;
  return {
    score: a.usability.score,
    rows: [{ label: n === null ? T.usabilidad.noPueden : T.usabilidad.firmarExige(n), points: a.usability.score }],
    how: T.usabilidad.como(),
  };
}

function inheritanceScoreRows(a: EngineAnalysis) {
  const inh = a.inheritance;
  const label =
    inh.status === 'ok'
      ? T.herencia.recuperan(inh.heirs.length > 0, inh.visits!)
      : inh.status === 'no-heirs'
        ? T.herencia.sinHerederos
        : T.herencia.noRecuperan;
  const b = inheritanceBreakdown(inh.visits, inh.lossCombinedRarity, inh.rebuild);
  const penalty = (reason: string, points: number): Row =>
    reason === 'no-descriptor' ? { label: T.herencia.sinDescriptor, points: -points } : fragility(points);
  const fragility = (points: number): Row => ({
    label: T.herencia.fragilidad(inh.losses.length, inh.lossRarities[0]!, inh.losses.length > 1 ? round1(inh.lossCombinedRarity!) : null),
    points: -points,
  });
  return {
    score: inh.score,
    rows: [{ label, points: b.base }, ...b.penalties.map((p) => penalty(p.reason, p.points))],
    how: T.herencia.como(),
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
            {model.locations.find((l) => l.id === id)?.name || UI.comun.sinNombre}
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
      {T.soloFirman.antes(who)} <strong>{signable.length ? signable.join(', ') : T.ningunaKey}</strong>
      {T.soloFirman.despues(needed)}
      {derivation.signable.size >= needed && T.faltanXpubs}
    </p>
  );
}

function Usability({ model, analysis }: { model: CustodyModel; analysis: EngineAnalysis }) {
  const locations = analysis.usability.locations;
  const derivation = useMemo(() => simulateSigning(model, locations ?? undefined), [model, locations]);
  return (
    <>
      {locations && (
        <Section title={T.usabilidad.dondeSeFirma}>
          <p className={styles.muted}>{T.usabilidad.minimoVisitar}</p>
          <Places model={model} ids={locations} />
        </Section>
      )}
      <Section title={T.porQue}>
        <Why model={model} derivation={derivation} who={T.usabilidad.quienes} />
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
      <Section title={T.herencia.titulo}>
        <p className={styles.muted}>{T.herencia.nadieMas}</p>
      </Section>
    );
  }
  return (
    <>
      <Section title={T.herencia.titulo}>
        <p className={styles.muted}>
          {T.herencia.trasFallecer} {inheritanceText(inh, model.people)}
          {inh.status === 'ok' ? T.herencia.yendoA : '.'}
        </p>
        {inh.locations && <Places model={model} ids={inh.locations} />}
        <Button icon={Flame} onClick={() => simulate({ kind: 'loss', events: ownerDeaths(model) }, 'inheritance')}>
          {T.herencia.simular}
        </Button>
      </Section>
      <Section title={T.porQue}>
        <Why model={model} derivation={derivation} who={inh.status === 'ok' ? T.herencia.losHerederos : T.herencia.quienesQuedan} />
      </Section>
      {inh.status === 'ok' && <HeirLossRoutes model={model} />}
      <LetterSection model={model} analysis={analysis} />
    </>
  );
}

/** La carta para los herederos: sale de esta misma simulación, con solo lo que necesitan y a lo que llegan. */
function LetterSection({ model, analysis }: { model: CustodyModel; analysis: EngineAnalysis }) {
  const letter = useMemo(() => inheritanceLetter(model, analysis.inheritance), [model, analysis.inheritance]);
  const [open, setOpen] = useState(false);
  if (letter.status !== 'ok') {
    return letter.missingDescriptor ? (
      <Section title={T.carta.titulo}>
        <p className={styles.muted}>{T.carta.sinDescriptor}</p>
      </Section>
    ) : null;
  }
  return (
    <Section title={T.carta.titulo}>
      <p className={styles.muted}>{T.carta.explicacion}</p>
      <Button icon={Mail} onClick={() => setOpen(true)}>
        {T.carta.preparar}
      </Button>
      {open && <InheritanceLetterSheet model={model} letter={letter} onClose={() => setOpen(false)} />}
    </Section>
  );
}
