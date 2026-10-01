import type { Analysis } from '@llave-inglesa/engine';
import { AlertTriangle, ChevronsLeft, ChevronsRight, Loader2, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { plural } from '../lib/text.ts';
import { useAnalysis } from '../store/analysis.ts';
import { useLayout } from '../store/layout.ts';
import styles from './Scoreboard.module.css';

type Level = 'good' | 'warn' | 'bad';

/** Umbrales de estado. Siempre con icono + texto, nunca solo color. */
function level(score: number): { level: Level; icon: LucideIcon; text: string } {
  if (score >= 75) return { level: 'good', icon: ShieldCheck, text: 'Bien' };
  if (score >= 50) return { level: 'warn', icon: AlertTriangle, text: 'Mejorable' };
  return { level: 'bad', icon: ShieldAlert, text: 'Débil' };
}

interface Metric {
  id: 'security' | 'resilience' | 'usability' | 'inheritance';
  label: string;
  /** Abreviatura para la barra plegada. */
  short: string;
  score: number;
  detail: string;
}

function metrics(a: Analysis): Metric[] {
  const cut = (n: number | null, upTo: number, what: string) =>
    n === null ? `ninguna combinación de ≤${upTo} lo consigue` : n === 0 ? 'ya ocurre ahora mismo' : `${what} con ${plural(n, 'suceso', 'sucesos a la vez')}`;
  const inh = a.inheritance;
  const sec = a.security;
  const secDetail =
    sec.minEffort === null
      ? `ningún robo con ≤${sec.searchedUpTo} ataques`
      : `robo más barato: esfuerzo ${sec.minEffort.toLocaleString('es')}` + (sec.cheapRoutes > 1 ? ` · ${sec.cheapRoutes} vías` : '');
  return [
    { id: 'security', label: 'Seguridad', short: 'Seg', score: sec.score, detail: secDetail },
    {
      id: 'resilience',
      label: 'Resiliencia', short: 'Res',
      score: a.resilience.score,
      detail:
        cut(a.resilience.minSize, a.resilience.searchedUpTo, 'pérdida') +
        (a.resilience.lockoutMinSize ? ` · bloqueo temporal con ${plural(a.resilience.lockoutMinSize, 'suceso', 'sucesos')}` : ''),
    },
    {
      id: 'usability',
      label: 'Usabilidad', short: 'Usa',
      score: a.usability.score,
      detail: a.usability.locations ? `firmar en ${plural(a.usability.locations.length, 'ubicación', 'ubicaciones')}` : 'no puede firmar de forma segura',
    },
    {
      id: 'inheritance',
      label: 'Herencia', short: 'Her',
      score: inh.score,
      detail:
        inh.status === 'ok'
          ? `herederos: ${plural(inh.locations!.length, 'ubicación', 'ubicaciones')}`
          : inh.status === 'no-heirs'
            ? 'no hay herederos'
            : 'los herederos no recuperan',
    },
  ];
}

function Tile({ metric, previous, stale }: { metric: Metric; previous: number | null; stale: boolean }) {
  const { level: lvl, icon: Icon, text } = level(metric.score);
  const delta = previous === null ? 0 : metric.score - previous;
  return (
    <div className={`${styles.tile} ${styles[lvl]} ${stale ? styles.stale : ''}`}>
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
    </div>
  );
}

/** Versión mínima de una tarjeta para la columna plegada: abreviatura, número e icono de estado. */
function MiniTile({ metric, stale }: { metric: Metric; stale: boolean }) {
  const { level: lvl, icon: Icon, text } = level(metric.score);
  return (
    <div className={`${styles.mini} ${styles[lvl]} ${stale ? styles.stale : ''}`} title={`${metric.label}: ${metric.score} de 100, ${text}`}>
      <span className={styles.label}>{metric.short}</span>
      <span className={styles.miniValue}>{metric.score}</span>
      <Icon size={13} className={styles.miniIcon} aria-label={text} />
    </div>
  );
}

/** Las cuatro puntuaciones, recalculadas en vivo, en cabeza de la columna. */
export function Scoreboard() {
  const { status, analysis, previous, ms } = useAnalysis();
  const collapsed = useLayout((s) => s.collapsed);
  const setCollapsed = useLayout((s) => s.setCollapsed);
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

  const fold = (
    <button className={styles.foldButton} onClick={() => setCollapsed(true)} aria-label="Plegar el panel" title="Plegar el panel para ver más mapa">
      <ChevronsLeft size={16} />
    </button>
  );

  if (!analysis) {
    return (
      <section className={styles.board} aria-live="polite">
        <div className={styles.footer}>
          <p className={styles.placeholder}>
            {status === 'invalid' ? 'Corrige los errores del modelo para analizarlo' : (
              <>
                <Loader2 size={14} className={styles.spin} aria-hidden /> Analizando…
              </>
            )}
          </p>
          {fold}
        </div>
      </section>
    );
  }

  const prev = previous ? Object.fromEntries(metrics(previous).map((m) => [m.id, m.score])) : null;

  return (
    <section className={styles.board} aria-label="Puntuaciones del esquema" aria-live="polite">
      <div className={styles.tiles}>
        {metrics(analysis).map((m) => (
          <Tile key={m.id} metric={m} previous={prev?.[m.id] ?? null} stale={stale} />
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
        {fold}
      </div>
    </section>
  );
}
