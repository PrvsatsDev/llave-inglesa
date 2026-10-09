import { indexModel } from '@llave-inglesa/domain';
import { Bug, CircleCheck, Eye, Hourglass, ShieldQuestion, Skull, X, XCircle, type LucideIcon } from 'lucide-react';
import { attackText, lossText, plural, UI } from '../lib/text.ts';
import type { Outcome } from '../scenario/view.ts';
import { useDocument } from '../store/document.ts';
import { useScenario, useScenarioView } from '../store/scenario.ts';
import styles from './ScenarioBanner.module.css';

const T = UI.banner;

export const OUTCOME: Record<Outcome, { icon: LucideIcon; text: string; level: 'bad' | 'good' | 'warn' }> = {
  stolen: { icon: Skull, text: T.resultado.stolen, level: 'bad' },
  safe: { icon: CircleCheck, text: T.resultado.safe, level: 'good' },
  recoverable: { icon: CircleCheck, text: T.resultado.recoverable, level: 'good' },
  lockout: { icon: Hourglass, text: T.resultado.lockout, level: 'warn' },
  lost: { icon: XCircle, text: T.resultado.lost, level: 'bad' },
};

/** Veredicto del escenario simulado, sobre el mapa. */
export function ScenarioBanner() {
  const model = useDocument((s) => s.model);
  const view = useScenarioView();
  const clear = useScenario((s) => s.set);
  if (!view) return null;

  const index = indexModel(model);
  const { icon: Icon, text, level } = OUTCOME[view.outcome];
  const steps = view.scenario.kind === 'attack' ? view.scenario.atoms.map((a) => attackText(a, index)) : view.scenario.events.map((e) => lossText(e, index));

  return (
    <div className={`${styles.banner} ${styles[level]}`} role="status" aria-live="polite">
      <Icon size={18} className={styles.icon} aria-hidden />
      <div className={styles.text}>
        <span className={styles.kicker}>{view.scenario.kind === 'attack' ? T.simulandoAtaque : T.simulandoDesgracia}</span>
        <span className={styles.steps}>{steps.join(' + ')}</span>
        <span className={styles.outcome}>{text}</span>
        {view.duress.length > 0 && (
          <span className={styles.privacy}>
            <ShieldQuestion size={12} aria-hidden /> {T.coaccion}
          </span>
        )}
        {view.compromised.size > 0 && (
          <span className={styles.privacy}>
            <Bug size={12} aria-hidden /> {plural(view.compromised.size, ...T.comprometidos)}
          </span>
        )}
        {view.exposure.exposed && (
          <span className={styles.privacy}>
            <Eye size={12} aria-hidden /> {view.outcome === 'stolen' ? T.yAdemas : T.pero} {T.veSaldo}
          </span>
        )}
      </div>
      <button className={styles.close} onClick={() => clear(null)} aria-label={T.salir} title={T.pistaSalir}>
        <X size={16} />
      </button>
    </div>
  );
}
