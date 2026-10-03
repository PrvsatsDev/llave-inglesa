import { AlertTriangle, Bitcoin, Check, Copy, FilePlus2, FolderOpen, KeyRound, Map as MapIcon, ShieldCheck, X, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useDialog, type DialogRequest } from '../store/dialog.ts';
import { AUTOR } from '../lib/autor.ts';
import { examples } from '../lib/examples.ts';
import { APP_VERSION } from '../version.ts';
import styles from './Dialogs.module.css';

const MIN_LENGTH = 10;

/** Estimación simple y honesta: longitud + variedad. No sustituye a una frase larga aleatoria. */
function strength(p: string): { score: 0 | 1 | 2 | 3; text: string } {
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (p.length < MIN_LENGTH) return { score: 0, text: `Demasiado corta (mínimo ${MIN_LENGTH})` };
  if (p.length >= 20 || (p.length >= 14 && variety >= 3)) return { score: 3, text: 'Fuerte' };
  if (p.length >= 12 && variety >= 2) return { score: 2, text: 'Aceptable' };
  return { score: 1, text: 'Débil: alárgala' };
}

function PasswordForm({ req }: { req: Extract<DialogRequest, { kind: 'password' }> }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const creating = req.mode === 'create';
  const s = strength(password);
  const mismatch = creating && confirm.length > 0 && confirm !== password;
  const valid = creating ? s.score > 0 && password === confirm : password.length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) req.resolve(password);
  };

  return (
    <form onSubmit={submit} className={styles.form}>
      <header className={styles.header}>
        <span className={styles.icon}>{creating ? <ShieldCheck size={18} /> : <KeyRound size={18} />}</span>
        <h2 className={styles.title}>{req.title}</h2>
      </header>
      <p className={styles.message}>{req.message}</p>
      <label className={styles.field}>
        <span>Contraseña</span>
        <input type="password" autoFocus autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {creating && (
        <>
          <div className={styles.meter} data-score={s.score} aria-live="polite">
            <span className={styles.bar} />
            <span className={styles.meterText}>{password ? s.text : `Mínimo ${MIN_LENGTH} caracteres. Mejor una frase larga.`}</span>
          </div>
          <label className={styles.field}>
            <span>Repítela</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
          </label>
          {mismatch && <p className={styles.error}>No coinciden.</p>}
          <p className={styles.warning}>
            <AlertTriangle size={14} aria-hidden /> Si la olvidas, no hay forma de recuperar el documento.
          </p>
        </>
      )}
      {req.error && <p className={styles.error}>{req.error}</p>}
      <footer className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => req.resolve(null)}>
          Cancelar
        </button>
        <button type="submit" className={styles.primary} disabled={!valid}>
          {creating ? 'Cifrar' : 'Abrir'}
        </button>
      </footer>
    </form>
  );
}

/** Una dirección para apoyar el proyecto, con botón de copiar. Las largas se muestran abreviadas. */
function SupportAddress({ icon: Icon, label, value, href }: { icon: LucideIcon; label: string; value: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };
  const shown = value.length > 40 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
  return (
    <span className={styles.support}>
      <Icon size={12} aria-hidden />
      <span className={styles.supportLabel}>{label}</span>
      {href ? (
        <a href={href} title={value}>
          {shown}
        </a>
      ) : (
        <span className={styles.supportValue} title={value}>
          {shown}
        </span>
      )}
      <button type="button" className={styles.copy} onClick={copy} aria-label={`Copiar la dirección ${label}`}>
        {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
        {copied ? 'Copiada' : 'Copiar'}
      </button>
    </span>
  );
}

/** Quién la hace: X y Nostr y, en «Acerca de», cómo apoyarlo (Lightning y silent payments on-chain). */
function Author({ support }: { support: boolean }) {
  return (
    <div className={styles.author}>
      <p className={styles.authorLine}>
        <span>
          Hecha por <strong>{AUTOR.nombre}</strong>
        </span>
        <span aria-hidden>·</span>
        <a href={AUTOR.x} target="_blank" rel="noopener noreferrer">
          X
        </a>
        <span aria-hidden>·</span>
        <a href={AUTOR.nostr} target="_blank" rel="noopener noreferrer">
          Nostr
        </a>
      </p>
      {support && (
        <p className={styles.authorLine}>
          <SupportAddress icon={Zap} label="Lightning" value={AUTOR.lightning} href={`lightning:${AUTOR.lightning}`} />
          <SupportAddress icon={Bitcoin} label="Silent payments" value={AUTOR.silentPayment} />
        </p>
      )}
    </div>
  );
}

/** Cabecera (logo, nombre, versión y cerrar) y qué es la herramienta: común a la bienvenida y a «Acerca de». */
function Intro({ onClose }: { onClose(): void }) {
  return (
    <>
      <header className={styles.header}>
        <img src="/logo.svg" alt="" width={40} height={40} />
        <h2 className={styles.title}>llave-inglesa</h2>
        <span className={styles.version}>v{APP_VERSION}</span>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
          <X size={16} aria-hidden />
        </button>
      </header>
      <p className={styles.lead}>Pon a prueba la custodia de tus bitcoins antes de que lo haga otro.</p>
      <ul className={styles.points}>
        <li>Describe qué keys, dispositivos y backups tienes, dónde están y quién sabe qué.</li>
        <li>
          La herramienta calcula cómo podrían robarte, qué desgracias te dejarían sin fondos, lo cómodo que es firmar y si tus
          herederos llegarían a ellos. Y siempre explica por qué.
        </li>
        <li>Todo ocurre en tu navegador: sin cuentas, sin red. Puedes guardar tu esquema cifrado.</li>
      </ul>
      <p className={styles.warning}>
        <AlertTriangle size={14} aria-hidden /> Nunca escribas frases semilla, claves privadas ni passphrases reales: no hacen falta.
      </p>
    </>
  );
}

/** Primera visita: qué es y por dónde empezar. Cerrarla equivale a ver el ejemplo. */
function Welcome({ req }: { req: Extract<DialogRequest, { kind: 'welcome' }> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.form}>
      <Intro onClose={() => req.resolve(null)} />
      <footer className={styles.welcomeActions}>
        <button className={styles.primary} onClick={() => req.resolve({ kind: 'example' })} data-autofocus>
          <MapIcon size={14} aria-hidden /> Ver un ejemplo
        </button>
        <button className={styles.secondary} onClick={() => req.resolve({ kind: 'new' })}>
          <FilePlus2 size={14} aria-hidden /> Empezar de cero
        </button>
        <button className={styles.secondary} onClick={() => fileRef.current?.click()}>
          <FolderOpen size={14} aria-hidden /> Abrir fichero
        </button>
      </footer>
      <p className={styles.hint}>
        En el selector de arriba hay {examples.length} ejemplos, de lo más habitual a lo más cuidado. Esto se puede volver a leer en «Acerca de»,
        pulsando el logo.
      </p>
      <Author support={false} />
      <input
        ref={fileRef}
        type="file"
        accept=".llave,.json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) req.resolve({ kind: 'open', file });
        }}
      />
    </div>
  );
}

/** «Acerca de»: lo mismo que la bienvenida, sin los botones de empezar, con el código y cómo apoyarlo. */
function About({ req }: { req: Extract<DialogRequest, { kind: 'about' }> }) {
  return (
    <div className={styles.form}>
      <Intro onClose={() => req.resolve()} />
      <p className={styles.hint}>
        Código abierto (MIT) y verificable: cada versión se puede recompilar y comparar con la publicada.{' '}
        <a className={styles.inlineLink} href={AUTOR.repo} target="_blank" rel="noopener noreferrer">
          Código en GitHub
        </a>
      </p>
      <Author support />
    </div>
  );
}

/** Contenedor de todos los diálogos modales (uno a la vez, con <dialog> nativo). */
export function Dialogs() {
  const current = useDialog((s) => s.current);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (current && !dialog.open) {
      dialog.showModal();
      // showModal enfoca el primer botón (el ✕ de cerrar); el principal se marca con data-autofocus.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!current && dialog.open) dialog.close();
  }, [current]);

  const cancel = () => {
    if (!current) return;
    if (current.kind === 'password' || current.kind === 'welcome') current.resolve(null);
    else if (current.kind === 'about') current.resolve();
    else if (current.kind === 'confirm') current.resolve(false);
    else current.resolve();
  };

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${current?.kind === 'welcome' || current?.kind === 'about' ? styles.wide : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
    >
      {current?.kind === 'password' && <PasswordForm key={current.title + (current.error ?? '')} req={current} />}
      {current?.kind === 'confirm' && (
        <div className={styles.form}>
          <h2 className={styles.title}>{current.title}</h2>
          <p className={styles.message}>{current.message}</p>
          <footer className={styles.actions}>
            <button className={styles.secondary} onClick={() => current.resolve(false)}>
              Cancelar
            </button>
            <button className={current.danger ? styles.danger : styles.primary} onClick={() => current.resolve(true)} autoFocus>
              {current.confirmLabel}
            </button>
          </footer>
        </div>
      )}
      {current?.kind === 'welcome' && <Welcome req={current} />}
      {current?.kind === 'about' && <About req={current} />}
      {current?.kind === 'alert' && (
        <div className={styles.form}>
          <h2 className={styles.title}>{current.title}</h2>
          {current.lines.map((l, i) => (
            <p key={i} className={styles.message}>
              {l}
            </p>
          ))}
          <footer className={styles.actions}>
            <button className={styles.primary} onClick={() => current.resolve()} autoFocus>
              Entendido
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
