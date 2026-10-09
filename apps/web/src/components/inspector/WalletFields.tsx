import { looksLikeSeedWords, normalizePath, parseXpub } from '@llave-inglesa/bitcoin';
import { XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SEED_WORDS_TEXT, UI, xpubProblemText } from '../../lib/text.ts';
import { Field } from './fields.tsx';
import styles from './fields.module.css';

const T = UI.cartera;

type Message = { tone: 'error' | 'hint'; text: string } | null;

/**
 * Lo escrito se guarda solo si es válido (normalizado); si no, el campo se queda vacío en el documento y avisa. Si el
 * valor cambia desde fuera (deshacer, importar un descriptor), el cuadro lo refleja.
 */
function useValidatedText(value: string | undefined, show: (v: string) => string) {
  const [text, setText] = useState(value === undefined ? '' : show(value));
  const [message, setMessage] = useState<Message>(null);
  const emitted = useRef(value);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setText(value === undefined ? '' : show(value));
    setMessage(null);
  }, [value, show]);
  const emit = (v: string | undefined, onChange: (v: string | undefined) => void) => {
    emitted.current = v;
    if (v !== value) onChange(v);
  };
  return { text, setText, message, setMessage, emit };
}

const showPath = (p: string) => `m/${p}`;

export function PathField({ value, onChange }: { value: string | undefined; onChange(v: string | undefined): void }) {
  const { text, setText, message, setMessage, emit } = useValidatedText(value, showPath);
  return (
    <Field label={T.derivacion}>
      {(fid) => (
        <>
          <input
            id={fid}
            className={`${styles.input} ${message ? styles.invalid : ''}`}
            value={text}
            placeholder={T.pistaDerivacion}
            spellCheck={false}
            onChange={(e) => {
              const t = e.target.value;
              setText(t);
              const path = normalizePath(t);
              setMessage(path === null ? { tone: 'error', text: T.errorDerivacion } : null);
              emit(path ? path : undefined, onChange);
            }}
          />
          {message && <p className={styles.errorHint}>{message.text}</p>}
        </>
      )}
    </Field>
  );
}

export function XpubField({ value, onChange }: { value: string | undefined; onChange(v: string | undefined): void }) {
  const { text, setText, message, setMessage, emit } = useValidatedText(value, String);
  const change = (t: string) => {
    if (looksLikeSeedWords(t)) {
      setText('');
      setMessage({ tone: 'error', text: SEED_WORDS_TEXT });
      emit(undefined, onChange);
      return;
    }
    if (t.trim() === '') {
      setText('');
      setMessage(null);
      emit(undefined, onChange);
      return;
    }
    const r = parseXpub(t);
    if (!r.ok) {
      // Una clave privada no se queda ni en el cuadro de texto.
      setText(r.problem === 'private' ? '' : t);
      setMessage({ tone: 'error', text: xpubProblemText(r.problem) });
      emit(undefined, onChange);
      return;
    }
    setText(t);
    const converted = r.value.writtenAs !== 'xpub' && r.value.writtenAs !== 'tpub';
    setMessage(converted ? { tone: 'hint', text: T.convertida(r.value.writtenAs, r.value.network === 'mainnet' ? 'xpub' : 'tpub') } : null);
    emit(r.value.xpub, onChange);
  };
  return (
    <Field label={T.xpub}>
      {(fid) => (
        <>
          <textarea
            id={fid}
            className={`${styles.textarea} ${styles.mono} ${message?.tone === 'error' ? styles.invalid : ''}`}
            value={text}
            rows={3}
            placeholder={T.pistaXpub}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => change(e.target.value)}
          />
          {message &&
            (message.tone === 'error' ? (
              <p className={styles.errorHint} role="alert">
                <XCircle size={12} aria-hidden />
                {message.text}
              </p>
            ) : (
              <p className={styles.hint}>{message.text}</p>
            ))}
        </>
      )}
    </Field>
  );
}
