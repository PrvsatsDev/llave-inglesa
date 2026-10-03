import { AlertTriangle, FilePlus2, FolderOpen, KeyRound, Map as MapIcon, ShieldCheck, Wrench } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useDialog, type DialogRequest } from '../store/dialog.ts';
import { examples } from '../lib/examples.ts';
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

/** Qué es la herramienta, la advertencia de no usar secretos reales y por dónde empezar. */
function Welcome({ req }: { req: Extract<DialogRequest, { kind: 'welcome' }> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.form}>
      <header className={styles.header}>
        <span className={styles.icon}>
          <Wrench size={18} />
        </span>
        <h2 className={styles.title}>llave-inglesa</h2>
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
      <footer className={styles.welcomeActions}>
        <button className={styles.primary} onClick={() => req.resolve({ kind: 'example' })} autoFocus>
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
        Hay {examples.length} ejemplos en el selector de arriba. Puedes volver aquí pulsando el logo.
      </p>
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

/** Contenedor de todos los diálogos modales (uno a la vez, con <dialog> nativo). */
export function Dialogs() {
  const current = useDialog((s) => s.current);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (current && !dialog.open) dialog.showModal();
    if (!current && dialog.open) dialog.close();
  }, [current]);

  const cancel = () => {
    if (!current) return;
    if (current.kind === 'password' || current.kind === 'welcome') current.resolve(null);
    else if (current.kind === 'confirm') current.resolve(false);
    else current.resolve();
  };

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${current?.kind === 'welcome' ? styles.wide : ''}`}
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
