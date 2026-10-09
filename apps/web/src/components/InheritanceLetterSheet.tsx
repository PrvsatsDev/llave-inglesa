import { indexModel, type CustodyModel, type Id } from '@llave-inglesa/domain';
import type { InheritanceLetter } from '@llave-inglesa/engine';
import { AlertTriangle, Printer, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LETTER_CALM,
  LETTER_FOOTER,
  LETTER_NO_DESCRIPTOR,
  LETTER_PRINT_ADVICE,
  LETTER_SPARE_NOTE,
  letterGreeting,
  letterHelpers,
  letterMemoryText,
  letterPieceText,
  letterSteps,
  letterWhatThereIs,
  letterWhen,
  UI,
} from '../lib/text.ts';
import { Button } from './inspector/fields.tsx';
import styles from './PrintSheet.module.css';

const T = UI.hojaCarta;

/**
 * La carta para los herederos, para imprimir. Los nombres reales y el mensaje personal se escriben aquí al vuelo:
 * viven solo mientras la hoja está abierta, no entran en el documento ni en el navegador.
 */
export function InheritanceLetterSheet({ model, letter, onClose }: { model: CustodyModel; letter: InheritanceLetter; onClose(): void }) {
  const index = indexModel(model);
  const [names, setNames] = useState<Record<Id, string>>({});
  const [message, setMessage] = useState('');
  const messageId = useId();
  const label = (id: Id) => names[id]?.trim() || index.label(id);
  // Los objetos van con su nombre tal cual (sin el "(Ubicación)" que añade el índice para distinguir repetidos).
  const itemLabel = (id: Id) => model.devices.find((d) => d.id === id)?.label ?? model.artifacts.find((a) => a.id === id)?.label ?? id;

  const people = [...new Set([...letter.owners, ...letter.heirs, ...letter.helpers, ...letter.memory.map((m) => m.person)])];
  const locations = [...new Set([...letter.stops.map((s) => s.location), ...letter.storage.map((s) => s.location)])];
  const today = UI.comun.fecha(new Date());
  const helpers = letterHelpers(letter, label);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const nameRow = (id: Id) => (
    <label key={id} className={styles.namesRow}>
      <span title={index.label(id)}>{index.label(id)}</span>
      <input
        className={styles.input}
        value={names[id] ?? ''}
        placeholder={index.label(id)}
        autoComplete="off"
        spellCheck={false}
        aria-label={T.nombreReal(index.label(id))}
        onChange={(e) => setNames((n) => ({ ...n, [id]: e.target.value }))}
      />
    </label>
  );

  return createPortal(
    <div className={`${styles.overlay} print-root`} role="dialog" aria-modal="true" aria-label={T.nombre}>
      <div className={styles.toolbar}>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>
          {UI.comun.imprimir}
        </Button>
        <Button icon={X} onClick={onClose}>
          {UI.comun.cerrar}
        </Button>
      </div>

      <aside className={styles.aside}>
        <p className={styles.advice}>
          <AlertTriangle size={14} aria-hidden />
          {LETTER_PRINT_ADVICE}
        </p>
        {letter.noDescriptorCopy && (
          <p className={styles.advice}>
            <AlertTriangle size={14} aria-hidden />
            {LETTER_NO_DESCRIPTOR}
          </p>
        )}
        <p className={styles.asideTitle}>{T.nombresReales}</p>
        <p>{T.noSeGuardan}</p>
        <div className={styles.names}>
          {people.map(nameRow)}
          {locations.map(nameRow)}
        </div>
        <label className={styles.asideTitle} htmlFor={messageId}>
          {T.mensaje}
        </label>
        <textarea
          id={messageId}
          className={styles.input}
          rows={4}
          value={message}
          autoComplete="off"
          placeholder={T.pistaMensaje}
          onChange={(e) => setMessage(e.target.value)}
        />
        {letter.storage.length > 0 && (
          <>
            <p className={styles.asideTitle}>{T.dondeGuardarla}</p>
            <ul className={styles.asideList}>
              {letter.storage.map((s) => (
                <li key={s.location}>
                  {label(s.location)}
                  {s.conditional ? T.buenSitio : T.laVeraQuienEntre}
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      <article className={`${styles.sheet} ${styles.letter}`}>
        <header className={styles.header}>
          <h1>{letterGreeting(letter, label)}</h1>
          <p className={styles.meta}>{T.escrita(today)}</p>
        </header>
        <p className={styles.intro}>{letterWhen(letter, label)}</p>
        <p>{letterWhatThereIs(model)}</p>

        <h2>{T.antesDeNada}</h2>
        <ul>
          {LETTER_CALM.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <h2>{T.queReunir}</h2>
        {helpers && <p>{helpers}</p>}
        {letter.stops.some((s) => s.pieces.some((p) => !p.needed)) && <p>{LETTER_SPARE_NOTE}</p>}
        {letter.stops.map((s) => (
          <section key={s.location}>
            <h3>{label(s.location)}</h3>
            <ul>
              {s.pieces.map((p) => (
                <li key={p.item}>
                  <strong>{itemLabel(p.item)}</strong>
                  {!p.needed && T.deReserva}: {letterPieceText(p, label)}.
                </li>
              ))}
            </ul>
          </section>
        ))}
        {letter.memory.length > 0 && (
          <>
            <h3>{T.deMemoria}</h3>
            <ul>
              {letter.memory.map((m, i) => (
                <li key={i}>{letterMemoryText(m, label)}</li>
              ))}
            </ul>
          </>
        )}

        <h2>{T.pasos}</h2>
        <ol>
          {letterSteps(model, letter).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>

        {message.trim() && (
          <>
            <h2>{T.unasPalabras}</h2>
            <p className={styles.message}>{message}</p>
          </>
        )}

        <footer className={styles.footer}>{LETTER_FOOTER}</footer>
      </article>
    </div>,
    document.body,
  );
}
