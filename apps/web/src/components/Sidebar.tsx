import { BadgeCheck, KeyRound } from 'lucide-react';
import { useDocument } from '../store/document.ts';
import { keyColor } from '../lib/key-colors.ts';
import { provenanceText } from '../lib/text.ts';
import { KeyChip } from './KeyChip.tsx';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const model = useDocument((s) => s.model);

  const stats = [
    { label: 'Keys', value: model.keys.length },
    { label: 'Dispositivos', value: model.devices.length },
    { label: 'Backups', value: model.artifacts.length },
    { label: 'Personas', value: model.people.length },
    { label: 'Ubicaciones', value: model.locations.length },
  ];

  return (
    <aside className={styles.sidebar} aria-label="Resumen del esquema">
      <section className={styles.section}>
        <h2 className={styles.title}>{model.name}</h2>
        {model.description && <p className={styles.description}>{model.description}</p>}
        <dl className={styles.stats}>
          {stats.map((s) => (
            <div key={s.label} className={styles.stat}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>
          <KeyRound size={14} aria-hidden /> Keys
        </h3>
        <ul className={styles.keyList}>
          {model.keys.map((k) => (
            <li key={k.id} className={styles.keyItem}>
              <div className={styles.keyRow}>
                <KeyChip label={k.label} color={keyColor(model, k.id)} />
                {k.passphrase && <span className={styles.badge}>+ passphrase</span>}
                {k.provenance.independentlyVerified && (
                  <span className={`${styles.badge} ${styles.verified}`} title="Derivación verificada con una herramienta independiente">
                    <BadgeCheck size={12} aria-hidden /> verificada
                  </span>
                )}
              </div>
              <p className={styles.provenance}>{provenanceText(k)}</p>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
