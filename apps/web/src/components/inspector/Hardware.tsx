import { CATALOG_DATE, HARDWARE_MODELS, type AdvisoryMatch, type CatalogModel, type Device, type Id } from '@llave-inglesa/domain';
import { advisoryText } from '@llave-inglesa/text';
import { AlertTriangle, ChevronDown, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { TextInput } from './fields.tsx';
import styles from './fields.module.css';

/** Valor del selector para un modelo fuera del catálogo (se escribe a mano). */
export const OTHER_MODEL = '';

const VENDORS = [...new Set(HARDWARE_MODELS.map((m) => m.vendor))];

const DEVICE_PREFIX = 'device:';

/**
 * Modelo del catálogo. Con `devices`, ofrece arriba los dispositivos del esquema: elegir uno
 * llama a `onPickDevice` (el selector sigue mostrando el modelo del catálogo que resulte).
 */
export function HardwareModelSelect({
  id,
  value,
  onChange,
  devices = [],
  onPickDevice,
}: {
  id?: string;
  value: CatalogModel | undefined;
  onChange(m: CatalogModel | undefined): void;
  devices?: readonly Device[];
  onPickDevice?(device: Id): void;
}) {
  return (
    <span className={styles.selectWrap}>
      <select
        id={id}
        className={styles.select}
        value={value?.id ?? OTHER_MODEL}
        onChange={(e) => {
          const v = e.target.value;
          if (v.startsWith(DEVICE_PREFIX)) onPickDevice?.(v.slice(DEVICE_PREFIX.length));
          else onChange(HARDWARE_MODELS.find((m) => m.id === v));
        }}
      >
        {onPickDevice && devices.length > 0 && (
          <optgroup label="Dispositivos de este esquema">
            {devices.map((d) => (
              <option key={d.id} value={`${DEVICE_PREFIX}${d.id}`}>
                {d.label}
                {d.model && d.model !== d.label ? ` (${d.model})` : ''}
              </option>
            ))}
          </optgroup>
        )}
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

const UNKNOWN_VENDOR = 'Desconocido';
const OTHER_VENDOR = '';
const sameVendor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Fabricante de un RNG: uno del catálogo, desconocido u otro escrito a mano. Elegirlo de la
 * lista evita variantes ("Coldcard Q" frente a "Coinkite") que el motor trataría como distintos.
 */
export function VendorSelect({ value, onChange }: { value: string; onChange(vendor: string): void }) {
  const listed = [UNKNOWN_VENDOR, ...VENDORS].find((v) => sameVendor(v, value));
  const [other, setOther] = useState(!listed);
  const selected = other ? OTHER_VENDOR : (listed ?? OTHER_VENDOR);
  return (
    <>
      <span className={styles.selectWrap}>
        <select
          className={styles.select}
          aria-label="Fabricante"
          value={selected}
          onChange={(e) => {
            const v = e.target.value;
            setOther(v === OTHER_VENDOR);
            if (v !== OTHER_VENDOR) onChange(v);
          }}
        >
          <option value={UNKNOWN_VENDOR}>Fabricante desconocido</option>
          {VENDORS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
          <option value={OTHER_VENDOR}>Otro (escribir a mano)</option>
        </select>
        <ChevronDown size={14} className={styles.selectChevron} aria-hidden />
      </span>
      {other && <TextInput value={sameVendor(value, UNKNOWN_VENDOR) ? '' : value} placeholder="Fabricante" onChange={onChange} />}
    </>
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
