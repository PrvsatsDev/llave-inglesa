import type { Analysis } from '@llave-inglesa/engine';
import { AlertTriangle, Loader2, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { plural } from '../lib/text.ts';
import { useAnalysis } from '../store/analysis.ts';
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
    { id: 'security', label: 'Seguridad', score: sec.score, detail: secDetail },
    {
      id: 'resilience',
      label: 'Resiliencia',
      score: a.resilience.score,
      detail:
        cut(a.resilience.minSize, a.resilience.searchedUpTo, 'pérdida') +
        (a.resilience.lockoutMinSize ? ` · bloqueo temporal con ${plural(a.resilience.lockoutMinSize, 'suceso', 'sucesos')}` : ''),
    },
    {
      id: 'usability',
      label: 'Usabilidad',
      score: a.usability.score,
      detail: a.usability.locations ? `firmar en ${plural(a.usability.locations.length, 'ubicación', 'ubicaciones')}` : 'no puede firmar de forma segura',
    },
    {
      id: 'inheritance',
      label: 'Herencia',
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

/** Marcador flotante con las cuatro puntuaciones, recalculadas en vivo. */
export function Scoreboard() {
  const { status, analysis, previous, ms } = useAnalysis();

  if (!analysis) {
    return (
      <div className={styles.board} aria-live="polite">
        <p className={styles.placeholder}>
          {status === 'invalid' ? 'Corrige los errores del modelo para analizarlo' : (
            <>
              <Loader2 size={14} className={styles.spin} aria-hidden /> Analizando…
            </>
          )}
        </p>
      </div>
    );
  }

  const prev = previous ? Object.fromEntries(metrics(previous).map((m) => [m.id, m.score])) : null;
  const stale = status !== 'ready';

  return (
    <section className={styles.board} aria-label="Puntuaciones del esquema" aria-live="polite">
      <div className={styles.tiles}>
        {metrics(analysis).map((m) => (
          <Tile key={m.id} metric={m} previous={prev?.[m.id] ?? null} stale={stale} />
        ))}
      </div>
      <p className={styles.footer}>
        {status === 'running' && (
          <>
            <Loader2 size={11} className={styles.spin} aria-hidden /> recalculando…
          </>
        )}
        {status === 'invalid' && <span className={styles.invalid}>Modelo con errores: análisis pausado</span>}
        {status === 'error' && <span className={styles.invalid}>El análisis ha fallado</span>}
        {status === 'ready' && ms !== null && <>análisis exhaustivo en {ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms</>}
      </p>
    </section>
  );
}
