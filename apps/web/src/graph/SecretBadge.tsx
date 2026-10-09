import { Asterisk, FileCode2, Lock } from 'lucide-react';
import type { CSSProperties } from 'react';
import { UI } from '../lib/text.ts';
import type { SecretBadge as Badge } from './build.ts';
import styles from './nodes.module.css';

const T = UI.mapa.insignias;
const KIND_TEXT = T.prefijo;
const KIND_TITLE = T.pistas;

/**
 * Insignia de un secreto. El relleno del punto dice qué es:
 * lleno = la key en sí (frase semilla o en memoria), anillo = passphrase, hueco = solo xpub.
 */
export function SecretBadge({ badge, withDevice = false }: { badge: Badge; withDevice?: boolean }) {
  switch (badge.kind) {
    case 'pin':
      return (
        <span className={styles.badge} title={T.pistaPin(badge.label)}>
          <Lock size={10} aria-hidden /> {T.pin}
          {withDevice && ` ${badge.label}`}
        </span>
      );
    case 'password':
      return (
        <span className={styles.badge} title={T.pistaContrasena(badge.label)}>
          <Asterisk size={10} aria-hidden /> {T.contrasena}
          {withDevice && ` ${badge.label}`}
        </span>
      );
    case 'descriptor':
      return (
        <span className={styles.badge} title={T.pistaDescriptor}>
          <FileCode2 size={10} aria-hidden /> {T.descriptor}
        </span>
      );
    default:
      return (
        <span
          className={`${styles.badge} ${styles.keyBadge} ${styles[badge.kind]}`}
          style={{ '--key-color': badge.color } as CSSProperties}
          title={T.pistaKey(KIND_TITLE[badge.kind], badge.label)}
        >
          <span className={styles.keyDot} aria-hidden />
          {KIND_TEXT[badge.kind]}
          {badge.label}
        </span>
      );
  }
}
