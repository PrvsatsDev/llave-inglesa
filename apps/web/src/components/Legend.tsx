import { Brain, ChevronDown, Lock } from 'lucide-react';
import { useState } from 'react';
import styles from './Legend.module.css';

export function Legend() {
  const [open, setOpen] = useState(true);
  return (
    <aside className={styles.legend} aria-label="Leyenda">
      <button className={styles.toggle} onClick={() => setOpen(!open)} aria-expanded={open}>
        Leyenda
        <ChevronDown size={13} className={open ? styles.open : ''} aria-hidden />
      </button>
      {open && (
        <ul className={styles.list}>
          <li><span className={`${styles.dot} ${styles.filled}`} /> la key en sí (frase semilla o en memoria)</li>
          <li><span className={`${styles.dot} ${styles.ring}`} /> passphrase</li>
          <li><span className={`${styles.dot} ${styles.hollow}`} /> solo xpub</li>
          <li><Lock size={11} className={styles.icon} /> protegido por PIN</li>
          <li><Brain size={11} className={styles.icon} /> lo sabe de memoria</li>
          <li><span className={`${styles.line} ${styles.solid}`} /> accede siempre</li>
          <li><span className={`${styles.line} ${styles.dashed}`} /> accede tras un fallecimiento</li>
        </ul>
      )}
    </aside>
  );
}
