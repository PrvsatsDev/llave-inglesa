import { ChevronDown, Wrench } from 'lucide-react';
import { useDocument } from '../store/document.ts';
import { examples } from '../lib/examples.ts';
import { keyColor } from '../lib/key-colors.ts';
import { policyText } from '../lib/text.ts';
import { KeyChip } from './KeyChip.tsx';
import styles from './Header.module.css';

export function Header() {
  const model = useDocument((s) => s.model);
  const origin = useDocument((s) => s.origin);
  const loadExample = useDocument((s) => s.loadExample);
  const label = (id: string) => model.keys.find((k) => k.id === id)?.label ?? id;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          <Wrench size={16} strokeWidth={2.5} />
        </span>
        <span className={styles.wordmark}>llave-inglesa</span>
      </div>

      <div className={styles.divider} aria-hidden />

      <label className={styles.select}>
        <select value={origin.id} onChange={(e) => loadExample(e.target.value)} aria-label="Esquema de ejemplo">
          {examples.map((e) => (
            <option key={e.id} value={e.id}>
              {e.model.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className={styles.chevron} aria-hidden />
      </label>

      <div className={styles.policy}>
        <span className={styles.policyLabel}>Política</span>
        <span className={styles.policyValue}>{policyText(model.policy, label)}</span>
        <span className={styles.keys}>
          {model.keys.map((k) => (
            <KeyChip key={k.id} label={k.label} color={keyColor(model, k.id)} />
          ))}
        </span>
      </div>

      <span className={styles.offline} title="La aplicación no puede hacer peticiones de red">
        <span className={styles.offlineDot} aria-hidden />
        100% local
      </span>
    </header>
  );
}
