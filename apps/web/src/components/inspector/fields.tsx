import type { CustodyModel, SecretRef } from '@llave-inglesa/domain';
import { ChevronDown, Trash2, X, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { secretBadge } from '../../graph/build.ts';
import { SecretBadge } from '../../graph/SecretBadge.tsx';
import { sameSecret } from '../../lib/secrets.ts';
import { UI } from '../../lib/text.ts';
import styles from './fields.module.css';

export function PanelHeader({ icon: Icon, kind, title, onClose, closeLabel }: {
  icon: LucideIcon;
  kind: string;
  title: string;
  /** Sin él no hay botón de cerrar: se sale con "volver" en las migas de pan. */
  onClose?(): void;
  closeLabel?: string;
}) {
  return (
    <header className={styles.panelHeader}>
      <span className={styles.panelIcon} aria-hidden>
        <Icon size={16} />
      </span>
      <span className={styles.panelTitles}>
        <span className={styles.kicker}>{kind}</span>
        <span className={styles.panelTitle}>{title || UI.comun.sinNombre}</span>
      </span>
      {onClose && (
        <button className={styles.iconButton} onClick={onClose} aria-label={closeLabel} title={closeLabel}>
          <X size={16} />
        </button>
      )}
    </header>
  );
}

export function Section({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className={styles.section}>
      {(title || action) && (
        <div className={styles.sectionHeader}>
          {title && <h3 className={styles.sectionTitle}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id)}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

/** Campo de texto. Vacío se marca como error, salvo si es `optional`. */
export function TextInput({ id, value, onChange, placeholder, optional = false }: { id?: string; value: string; onChange(v: string): void; placeholder?: string; optional?: boolean }) {
  return (
    <input
      id={id}
      className={`${styles.input} ${!optional && value.trim() === '' ? styles.invalid : ''}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
    />
  );
}

export function TextArea({ id, value, onChange, placeholder }: { id?: string; value: string; onChange(v: string): void; placeholder?: string }) {
  return <textarea id={id} className={styles.textarea} value={value} rows={3} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string>({ id, value, options, onChange }: { id?: string; value: T; options: readonly { value: T; label: string }[]; onChange(v: T): void }) {
  return (
    <span className={styles.selectWrap}>
      <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className={styles.selectChevron} aria-hidden />
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={`${styles.segment} ${o.value === value ? styles.segmentActive : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange(v: boolean): void; label: string; hint?: string }) {
  return (
    <label className={styles.switchRow}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      <input type="checkbox" className={styles.switch} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Selector múltiple de secretos como insignias que se encienden y apagan. */
export function SecretToggles({ model, options, selected, onToggle, empty }: {
  model: CustodyModel;
  options: SecretRef[];
  selected: SecretRef[];
  onToggle(s: SecretRef): void;
  empty?: string;
}) {
  if (options.length === 0) return <p className={styles.hint}>{empty ?? UI.campos.sinOpciones}</p>;
  return (
    <div className={styles.toggles}>
      {options.map((s, i) => {
        const on = selected.some((x) => sameSecret(x, s));
        return (
          <button key={i} className={`${styles.toggle} ${on ? styles.toggleOn : ''}`} aria-pressed={on} onClick={() => onToggle(s)}>
            <SecretBadge badge={secretBadge(model, s)} withDevice />
          </button>
        );
      })}
    </div>
  );
}

export function Button({ children, onClick, variant = 'ghost', icon: Icon, disabled, title }: {
  children: ReactNode;
  onClick(): void;
  variant?: 'ghost' | 'primary' | 'danger';
  icon?: LucideIcon;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button className={`${styles.button} ${styles[variant]}`} onClick={onClick} disabled={disabled} title={title}>
      {Icon && <Icon size={14} aria-hidden />}
      {children}
    </button>
  );
}

export function DeleteButton({ label, onClick, disabled, reason }: { label: string; onClick(): void; disabled?: boolean; reason?: string }) {
  return (
    <div className={styles.dangerZone}>
      <Button variant="danger" icon={Trash2} onClick={onClick} disabled={disabled} title={disabled ? reason : undefined}>
        {label}
      </Button>
      {disabled && reason && <p className={styles.hint}>{reason}</p>}
    </div>
  );
}
