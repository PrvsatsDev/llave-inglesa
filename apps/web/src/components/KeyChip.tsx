import { Hourglass } from 'lucide-react';
import type { CSSProperties } from 'react';
import { UI, waitText } from '../lib/text.ts';
import styles from './KeyChip.module.css';

interface Props {
  label: string;
  color: string;
  size?: 'sm' | 'md';
  /** Si la key solo sirve tras un timelock: la espera, en bloques. */
  wait?: number | undefined;
  /** Si no es la key entera sino shares suyas que no bastan: medio punto, y la explicación al pasar el ratón. */
  half?: string | undefined;
}

/** Identidad visual de una key: punto de color + nombre (y, si solo sirve tras esperar, un reloj de arena y la espera). */
export function KeyChip({ label, color, size = 'md', wait, half }: Props) {
  return (
    <span
      className={`${styles.chip} ${styles[size]}`}
      style={{ '--key-color': color } as CSSProperties}
      title={[...(half ? [half] : []), ...(wait ? [UI.mapa.soloTrasEsperar(waitText(wait))] : [])].join('. ') || undefined}
    >
      <span className={`${styles.dot} ${half ? styles.half : ''}`} aria-hidden />
      {label}
      {wait && (
        <span className={styles.wait}>
          <Hourglass size={size === 'sm' ? 10 : 12} aria-hidden />
          {waitText(wait)}
        </span>
      )}
    </span>
  );
}
