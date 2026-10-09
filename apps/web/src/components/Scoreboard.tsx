import { scoreBand, type Analysis, type ScoreBand } from '@llave-inglesa/engine';
import { AlertTriangle, BadgeCheck, ChevronsRight, Loader2, ShieldAlert, ShieldCheck, ShieldX, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { METRIC_LABEL } from '../lib/sections.ts';
import { plural, SCORE_BAND_TEXT, UI } from '../lib/text.ts';
import { useAnalysis } from '../store/analysis.ts';
import { useLayout } from '../store/layout.ts';
import { useNavigation, type MetricId } from '../store/navigation.ts';
import { useSelection } from '../store/selection.ts';
import styles from './Scoreboard.module.css';

const T = UI.puntuaciones;
const num = UI.comun.numero;

const BAND_ICON: Record<ScoreBand, LucideIcon> = {
  'very-poor': ShieldX,
  weak: ShieldAlert,
  fair: AlertTriangle,
  good: ShieldCheck,
  excellent: BadgeCheck,
};

/** Banda de una puntuación (las de la calibración). Siempre con icono + texto, nunca solo color. */
export function level(score: number): { level: ScoreBand; icon: LucideIcon; text: string } {
  const band = scoreBand(score);
  return { level: band, icon: BAND_ICON[band], text: SCORE_BAND_TEXT[band] };
}

interface Metric {
  id: MetricId;
  label: string;
  /** Abreviatura para la barra plegada. */
  short: string;
  score: number;
  detail: string;
}

function metrics(a: Analysis): Metric[] {
  const inh = a.inheritance;
  const sec = a.security;
  const secDetail =
    sec.minEffort === null
      ? T.seguridad.sinRobo(sec.searchedUpTo)
      : T.seguridad.roboMasBarato(num(sec.minEffort)) + (sec.cheapRoutes > 1 ? ` · ${T.seguridad.vias(sec.cheapRoutes)}` : '');
  return [
    { id: 'security', label: METRIC_LABEL.security, short: T.abreviaturas.security, score: sec.score, detail: secDetail },
    {
      id: 'resilience',
      label: METRIC_LABEL.resilience, short: T.abreviaturas.resilience,
      score: a.resilience.score,
      detail: !a.resilience.recoverableNow
        ? T.resiliencia.yaNoRecuperable
        : (a.resilience.minRarity === null
            ? T.resiliencia.sinPerdida(a.resilience.searchedUpTo)
            : T.resiliencia.perdidaMasProbable(num(a.resilience.minRarity))) +
          (a.resilience.lockoutMinRarity !== null ? ` · ${T.resiliencia.bloqueo(num(a.resilience.lockoutMinRarity))}` : ''),
    },
    {
      id: 'usability',
      label: METRIC_LABEL.usability, short: T.abreviaturas.usability,
      score: a.usability.score,
      detail: a.usability.locations ? T.usabilidad.firmarEn(plural(a.usability.visits!, ...T.ubicaciones)) : T.usabilidad.noPuede,
    },
    {
      id: 'inheritance',
      label: METRIC_LABEL.inheritance, short: T.abreviaturas.inheritance,
      score: inh.score,
      detail:
        inh.status === 'ok'
          ? T.herencia.herederos(plural(inh.visits!, ...T.ubicaciones))
          : inh.status === 'no-heirs'
            ? T.herencia.sinHerederos
            : T.herencia.noRecuperan,
    },
  ];
}

/** Cada tarjeta es la puerta a su análisis: pulsarla lleva a Análisis › esa métrica. */
function Tile({ metric, previous, stale, current }: { metric: Metric; previous: number | null; stale: boolean; current: boolean }) {
  const { level: lvl, icon: Icon, text } = level(metric.score);
  const delta = previous === null ? 0 : metric.score - previous;
  const goMetric = useNavigation((s) => s.goMetric);
  return (
    <button
      className={`${styles.tile} ${styles[lvl]} ${stale ? styles.stale : ''} ${current ? styles.current : ''}`}
      onClick={() => goMetric(metric.id)}
      aria-current={current ? 'page' : undefined}
      title={T.pistaTarjeta(metric.label, metric.detail)}
    >
      <div className={styles.top}>
        <span className={styles.label}>{metric.label}</span>
        {delta !== 0 && (
          <span className={`${styles.delta} ${delta > 0 ? styles.up : styles.down}`} title={T.pistaCambio}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
          </span>
        )}
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{metric.score}</span>
        <span className={styles.status}>
          <Icon size={13} aria-hidden /> {text}
        </span>
      </div>
      <div
        className={styles.meter}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={metric.score}
        aria-label={T.medidor(metric.label, metric.score, text)}
      >
        <span className={styles.fill} style={{ '--value': `${metric.score}%` } as CSSProperties} />
      </div>
      <p className={styles.detail}>{metric.detail}</p>
    </button>
  );
}

/** Versión mínima de una tarjeta para la columna plegada: abreviatura, número e icono de estado. */
function MiniTile({ metric, stale }: { metric: Metric; stale: boolean }) {
  const { level: lvl, icon: Icon, text } = level(metric.score);
  const goMetric = useNavigation((s) => s.goMetric);
  const setCollapsed = useLayout((s) => s.setCollapsed);
  return (
    <button
      className={`${styles.mini} ${styles[lvl]} ${stale ? styles.stale : ''}`}
      onClick={() => {
        setCollapsed(false);
        goMetric(metric.id);
      }}
      title={T.pistaMini(metric.label, metric.score, text)}
    >
      <span className={styles.label}>{metric.short}</span>
      <span className={styles.miniValue}>{metric.score}</span>
      <Icon size={13} className={styles.miniIcon} aria-label={text} />
    </button>
  );
}

/** Las cuatro puntuaciones, recalculadas en vivo, en cabeza de la columna. */
export function Scoreboard() {
  const { status, analysis, previous, ms } = useAnalysis();
  const collapsed = useLayout((s) => s.collapsed);
  const setCollapsed = useLayout((s) => s.setCollapsed);
  const section = useNavigation((s) => s.section);
  const metricShown = useNavigation((s) => s.metric);
  const selected = useSelection((s) => s.selected !== null);
  const stale = status !== 'ready';

  if (collapsed) {
    return (
      <section className={styles.rail} aria-label={T.nombre} aria-live="polite">
        <button className={styles.foldButton} onClick={() => setCollapsed(false)} aria-label={T.desplegar} title={T.desplegar}>
          <ChevronsRight size={16} />
        </button>
        {analysis ? (
          metrics(analysis).map((m) => <MiniTile key={m.id} metric={m} stale={stale} />)
        ) : (
          <Loader2 size={14} className={styles.spin} aria-label={T.analizando} />
        )}
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className={styles.board} aria-live="polite">
        <p className={styles.placeholder}>
          {status === 'invalid' ? T.corrigeErrores : (
            <>
              <Loader2 size={14} className={styles.spin} aria-hidden /> {T.analizandoPuntos}
            </>
          )}
        </p>
      </section>
    );
  }

  const current = section === 'analysis' && !selected ? metricShown : null;
  const prev = previous ? Object.fromEntries(metrics(previous).map((m) => [m.id, m.score])) : null;

  return (
    <section className={styles.board} aria-label={T.nombre} aria-live="polite">
      <div className={styles.tiles}>
        {metrics(analysis).map((m) => (
          <Tile key={m.id} metric={m} previous={prev?.[m.id] ?? null} stale={stale} current={m.id === current} />
        ))}
      </div>
      <div className={styles.footer}>
        <p className={styles.footerText}>
          {status === 'running' && (
            <>
              <Loader2 size={11} className={styles.spin} aria-hidden /> {T.recalculando}
            </>
          )}
          {status === 'invalid' && <span className={styles.invalid}>{T.pausado}</span>}
          {status === 'error' && <span className={styles.invalid}>{T.fallido}</span>}
          {status === 'ready' && ms !== null && <>{T.tiempo(ms < 10 ? ms.toFixed(1) : String(Math.round(ms)))}</>}
        </p>
      </div>
    </section>
  );
}
