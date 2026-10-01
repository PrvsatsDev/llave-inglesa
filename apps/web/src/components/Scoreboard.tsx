import type { Analysis } from '@llave-inglesa/engine';
import { AlertTriangle, ChevronsRight, Loader2, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { METRIC_LABEL } from '../lib/sections.ts';
import { plural } from '../lib/text.ts';
import { useAnalysis } from '../store/analysis.ts';
import { useLayout } from '../store/layout.ts';
import { useNavigation, type MetricId } from '../store/navigation.ts';
import { useSelection } from '../store/selection.ts';
import styles from './Scoreboard.module.css';

type Level = 'good' | 'warn' | 'bad';

/** Umbrales de estado. Siempre con icono + texto, nunca solo color. */
export function level(score: number): { level: Level; icon: LucideIcon; text: string } {
  if (score >= 75) return { level: 'good', icon: ShieldCheck, text: 'Bien' };
  if (score >= 50) return { level: 'warn', icon: AlertTriangle, text: 'Mejorable' };
  return { level: 'bad', icon: ShieldAlert, text: 'Débil' };
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
      ? `ningún robo con ≤${sec.searchedUpTo} ataques`
      : `robo más barato: esfuerzo ${sec.minEffort.toLocaleString('es')}` + (sec.cheapRoutes > 1 ? ` · ${sec.cheapRoutes} vías` : '');
  return [
    { id: 'security', label: METRIC_LABEL.security, short: 'Seg', score: sec.score, detail: secDetail },
    {
      id: 'resilience',
      label: METRIC_LABEL.resilience, short: 'Res',
      score: a.resilience.score,
      detail: !a.resilience.recoverableNow
        ? 'ya ahora no se puede recuperar'
        : (a.resilience.minRarity === null
            ? `ninguna pérdida con ≤${a.resilience.searchedUpTo} desgracias`
            : `pérdida más probable: rareza ${a.resilience.minRarity.toLocaleString('es')}`) +
          (a.resilience.lockoutMinRarity !== null ? ` · bloqueo temporal: rareza ${a.resilience.lockoutMinRarity.toLocaleString('es')}` : ''),
    },
    {
      id: 'usability',
      label: METRIC_LABEL.usability, short: 'Usa',
      score: a.usability.score,
      detail: a.usability.locations ? `firmar en ${plural(a.usability.visits!, 'ubicación', 'ubicaciones')}` : 'no puede firmar de forma segura',
    },
    {
      id: 'inheritance',
      label: METRIC_LABEL.inheritance, short: 'Her',
      score: inh.score,
      detail:
        inh.status === 'ok'
          ? `herederos: ${plural(inh.visits!, 'ubicación', 'ubicaciones')}`
          : inh.status === 'no-heirs'
            ? 'no hay herederos'
            : 'los herederos no recuperan',
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
      title={`${metric.label}: ${metric.detail}. Pulsa para ver por qué`}
    >
      <div className={styles.top}>
        <span className={styles.label}>{metric.label}</span>
        {delta !== 0 && (
          <span className={`${styles.delta} ${delta > 0 ? styles.up : styles.down}`} title="Cambio respecto al último análisis">
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
        aria-label={`${metric.label}: ${metric.score} de 100, ${text}`}
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
      title={`${metric.label}: ${metric.score} de 100, ${text}. Pulsa para ver por qué`}
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
      <section className={styles.rail} aria-label="Puntuaciones del esquema" aria-live="polite">
        <button className={styles.foldButton} onClick={() => setCollapsed(false)} aria-label="Desplegar el panel" title="Desplegar el panel">
          <ChevronsRight size={16} />
        </button>
        {analysis ? (
          metrics(analysis).map((m) => <MiniTile key={m.id} metric={m} stale={stale} />)
        ) : (
          <Loader2 size={14} className={styles.spin} aria-label="Analizando" />
        )}
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className={styles.board} aria-live="polite">
        <p className={styles.placeholder}>
          {status === 'invalid' ? 'Corrige los errores del modelo para analizarlo' : (
            <>
              <Loader2 size={14} className={styles.spin} aria-hidden /> Analizando…
            </>
          )}
        </p>
      </section>
    );
  }

  const current = section === 'analysis' && !selected ? metricShown : null;
  const prev = previous ? Object.fromEntries(metrics(previous).map((m) => [m.id, m.score])) : null;

  return (
    <section className={styles.board} aria-label="Puntuaciones del esquema" aria-live="polite">
      <div className={styles.tiles}>
        {metrics(analysis).map((m) => (
          <Tile key={m.id} metric={m} previous={prev?.[m.id] ?? null} stale={stale} current={m.id === current} />
        ))}
      </div>
      <div className={styles.footer}>
        <p className={styles.footerText}>
          {status === 'running' && (
            <>
              <Loader2 size={11} className={styles.spin} aria-hidden /> recalculando…
            </>
          )}
          {status === 'invalid' && <span className={styles.invalid}>Modelo con errores: análisis pausado</span>}
          {status === 'error' && <span className={styles.invalid}>El análisis ha fallado</span>}
          {status === 'ready' && ms !== null && <>análisis exhaustivo en {ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms</>}
        </p>
      </div>
    </section>
  );
}
