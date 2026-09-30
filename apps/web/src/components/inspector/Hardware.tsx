import { CATALOG_DATE, HARDWARE_MODELS, type AdvisoryMatch, type CatalogModel } from '@llave-inglesa/domain';
import { advisoryText } from '@llave-inglesa/text';
import { AlertTriangle, ChevronDown, ShieldAlert } from 'lucide-react';
import styles from './fields.module.css';

/** Valor del selector para un modelo fuera del catálogo (se escribe a mano). */
export const OTHER_MODEL = '';

const VENDORS = [...new Set(HARDWARE_MODELS.map((m) => m.vendor))];

export function HardwareModelSelect({ id, value, onChange }: { id?: string; value: CatalogModel | undefined; onChange(m: CatalogModel | undefined): void }) {
  return (
    <span className={styles.selectWrap}>
      <select
        id={id}
        className={styles.select}
        value={value?.id ?? OTHER_MODEL}
        onChange={(e) => onChange(HARDWARE_MODELS.find((m) => m.id === e.target.value))}
      >
        {VENDORS.map((vendor) => (
          <optgroup key={vendor} label={vendor}>
            {HARDWARE_MODELS.filter((m) => m.vendor === vendor).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.discontinued ? ' (descatalogado)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER_MODEL}>Otro (escribir a mano)</option>
      </select>
      <ChevronDown size={14} className={styles.selectChevron} aria-hidden />
    </span>
  );
}

const DURESS_TEXT = { decoy: 'señuelo', wipe: 'borrado' } as const;

/** Resumen de lo que el catálogo sabe del modelo. */
export function catalogFeatures(m: CatalogModel): string {
  const features = [
    m.antiExfil ? 'anti-exfil' : null,
    m.duress.length > 0 ? `PIN de coacción (${m.duress.map((d) => DURESS_TEXT[d]).join(' y ')})` : 'sin PIN de coacción',
    m.registersMultisig ? 'registra multisig' : 'no registra multisig',
  ].filter(Boolean);
  return `Según el catálogo (${CATALOG_DATE}): ${features.join(' · ')}.`;
}

export function AdvisoryList({ matches }: { matches: readonly AdvisoryMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <ul className={styles.list}>
      {matches.map((match) => {
        const t = advisoryText(match);
        const severe = match.advisory.exploited;
        const Icon = severe ? ShieldAlert : AlertTriangle;
        return (
          <li key={match.advisory.id} className={`${styles.advisory} ${severe ? styles.advisorySevere : ''}`}>
            <Icon size={16} className={styles.advisoryIcon} aria-hidden />
            <div>
              <strong>{t.title}</strong> <span className={styles.hint}>({match.advisory.disclosed})</span>
              <p className={styles.advisoryText}>{t.detail}</p>
              {t.mitigations && <p className={styles.advisoryText}>{t.mitigations}</p>}
              <a className={styles.link} href={match.advisory.sources[0]} target="_blank" rel="noopener noreferrer">
                Fuente
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
