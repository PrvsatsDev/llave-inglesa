import { indexModel } from '@llave-inglesa/domain';
import { CircleCheck, Hourglass, Skull, X, XCircle, type LucideIcon } from 'lucide-react';
import { attackText, lossText } from '../lib/text.ts';
import type { Outcome } from '../scenario/view.ts';
import { useDocument } from '../store/document.ts';
import { useScenario, useScenarioView } from '../store/scenario.ts';
import styles from './ScenarioBanner.module.css';

const OUTCOME: Record<Outcome, { icon: LucideIcon; text: string; level: 'bad' | 'good' | 'warn' }> = {
  stolen: { icon: Skull, text: 'El atacante puede gastar tus fondos', level: 'bad' },
  safe: { icon: CircleCheck, text: 'No le basta para robar', level: 'good' },
  recoverable: { icon: CircleCheck, text: 'Los fondos siguen siendo recuperables', level: 'good' },
  lockout: { icon: Hourglass, text: 'Bloqueados hasta el fallecimiento; después, recuperables', level: 'warn' },
  lost: { icon: XCircle, text: 'Fondos perdidos para siempre', level: 'bad' },
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
        <span className={styles.kicker}>{view.scenario.kind === 'attack' ? 'Simulando ataque' : 'Simulando desgracia'}</span>
        <span className={styles.steps}>{steps.join(' + ')}</span>
        <span className={styles.outcome}>{text}</span>
      </div>
      <button className={styles.close} onClick={() => clear(null)} aria-label="Salir de la simulación" title="Salir (Esc)">
        <X size={16} />
      </button>
    </div>
  );
}
