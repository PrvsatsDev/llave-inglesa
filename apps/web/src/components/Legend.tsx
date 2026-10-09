import { Brain, ChevronDown, Lock } from 'lucide-react';
import { useState } from 'react';
import { UI } from '../lib/text.ts';
import { NARROW_QUERY } from '../store/mobile.ts';
import styles from './Legend.module.css';

const T = UI.marco.leyenda;

export function Legend() {
  // En pantalla estrecha empieza plegada: abierta taparía medio mapa.
  const [open, setOpen] = useState(() => !window.matchMedia?.(NARROW_QUERY).matches);
  return (
    <aside className={styles.legend} aria-label={T.titulo}>
      <button className={styles.toggle} onClick={() => setOpen(!open)} aria-expanded={open}>
        {T.titulo}
        <ChevronDown size={13} className={open ? styles.open : ''} aria-hidden />
      </button>
      {open && (
        <ul className={styles.list}>
          <li><span className={`${styles.dot} ${styles.filled}`} /> {T.key}</li>
          <li><span className={`${styles.dot} ${styles.ring}`} /> {T.passphrase}</li>
          <li><span className={`${styles.dot} ${styles.hollow}`} /> {T.xpub}</li>
          <li><Lock size={11} className={styles.icon} /> {T.pin}</li>
          <li><Brain size={11} className={styles.icon} /> {T.memoria}</li>
          <li><span className={`${styles.line} ${styles.solid}`} /> {T.siempre}</li>
          <li><span className={`${styles.line} ${styles.dashed}`} /> {T.trasFallecer}</li>
        </ul>
      )}
    </aside>
  );
}
