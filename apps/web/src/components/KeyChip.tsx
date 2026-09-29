import type { CSSProperties } from 'react';
import styles from './KeyChip.module.css';

interface Props {
  label: string;
  color: string;
  size?: 'sm' | 'md';
}

/** Identidad visual de una key: punto de color + nombre. */
export function KeyChip({ label, color, size = 'md' }: Props) {
  return (
    <span className={`${styles.chip} ${styles[size]}`} style={{ '--key-color': color } as CSSProperties}>
      <span className={styles.dot} aria-hidden />
      {label}
    </span>
  );
}
