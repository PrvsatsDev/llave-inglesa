import { Asterisk, FileCode2, Lock } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { SecretBadge as Badge } from './build.ts';
import styles from './nodes.module.css';

const KIND_TEXT = { holds: '', seed: '', passphrase: 'pass ', xpub: 'xpub ' } as const;
const KIND_TITLE = {
  holds: 'Key guardada en el dispositivo',
  seed: 'Semilla (palabras)',
  passphrase: 'Passphrase',
  xpub: 'Clave pública extendida',
} as const;

/**
 * Insignia de un secreto. El relleno del punto dice qué es:
 * lleno = la key en sí (semilla o en memoria), anillo = passphrase, hueco = solo xpub.
 */
export function SecretBadge({ badge, withDevice = false }: { badge: Badge; withDevice?: boolean }) {
  switch (badge.kind) {
    case 'pin':
      return (
        <span className={styles.badge} title={`PIN de ${badge.label}`}>
          <Lock size={10} aria-hidden /> PIN{withDevice && ` ${badge.label}`}
        </span>
      );
    case 'password':
      return (
        <span className={styles.badge} title={`Contraseña de ${badge.label}`}>
          <Asterisk size={10} aria-hidden /> contraseña{withDevice && ` ${badge.label}`}
        </span>
      );
    case 'descriptor':
      return (
        <span className={styles.badge} title="Descriptor del wallet: política y todas las xpubs">
          <FileCode2 size={10} aria-hidden /> descriptor
        </span>
      );
    default:
      return (
        <span
          className={`${styles.badge} ${styles.keyBadge} ${styles[badge.kind]}`}
          style={{ '--key-color': badge.color } as CSSProperties}
          title={`${KIND_TITLE[badge.kind]} de ${badge.label}`}
        >
          <span className={styles.keyDot} aria-hidden />
          {KIND_TEXT[badge.kind]}
          {badge.label}
        </span>
      );
  }
}
