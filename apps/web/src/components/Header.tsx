import { ChevronDown, Redo2, Undo2, Wrench } from 'lucide-react';
import { examples } from '../lib/examples.ts';
import { keyColor } from '../lib/key-colors.ts';
import { policyText } from '../lib/text.ts';
import { loadExample } from '../storage/actions.ts';
import { hasUnsavedChanges, useDocument, type DocumentOrigin } from '../store/document.ts';
import { FileMenu } from './FileMenu.tsx';
import { KeyChip } from './KeyChip.tsx';
import styles from './Header.module.css';

const CURRENT = '__actual';

function originText(origin: DocumentOrigin): string {
  switch (origin.kind) {
    case 'example': return 'ejemplo';
    case 'new': return 'nuevo';
    case 'file': return origin.name;
    case 'local': return 'guardado en el navegador';
  }
}

/** Estado de guardado, siempre con texto (no solo color). */
function SaveStatus() {
  const origin = useDocument((s) => s.origin);
  const dirty = useDocument(hasUnsavedChanges);
  if (origin.kind === 'example' && !dirty) return null;
  const state = dirty ? 'dirty' : 'saved';
  return (
    <span className={`${styles.status} ${styles[state]}`} title={dirty ? 'Guarda con Ctrl+S (cifrado, en este navegador)' : undefined}>
      <span className={styles.statusDot} aria-hidden />
      {dirty ? 'Sin guardar' : 'Guardado'}
    </span>
  );
}

export function Header() {
  const model = useDocument((s) => s.model);
  const origin = useDocument((s) => s.origin);
  const canUndo = useDocument((s) => s.past.length > 0);
  const canRedo = useDocument((s) => s.future.length > 0);
  const undo = useDocument((s) => s.undo);
  const redo = useDocument((s) => s.redo);
  const label = (id: string) => model.keys.find((k) => k.id === id)?.label ?? id;
  const value = origin.kind === 'example' ? origin.id : CURRENT;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          <Wrench size={16} strokeWidth={2.5} />
        </span>
        <span className={styles.wordmark}>llave-inglesa</span>
      </div>

      <div className={styles.divider} aria-hidden />

      <FileMenu />

      <label className={styles.select}>
        <select value={value} onChange={(e) => void loadExample(e.target.value)} aria-label="Documento abierto o ejemplo">
          {origin.kind !== 'example' && (
            <option value={CURRENT}>
              {model.name} ({originText(origin)})
            </option>
          )}
          <optgroup label="Ejemplos">
            {examples.map((e) => (
              <option key={e.id} value={e.id}>
                {e.model.name}
              </option>
            ))}
          </optgroup>
        </select>
        <ChevronDown size={14} className={styles.chevron} aria-hidden />
      </label>

      <SaveStatus />

      <div className={styles.policy}>
        <span className={styles.policyLabel}>Política</span>
        <span className={styles.policyValue}>{policyText(model.policy, label)}</span>
        <span className={styles.keys}>
          {model.keys.map((k) => (
            <KeyChip key={k.id} label={k.label} color={keyColor(model, k.id)} />
          ))}
        </span>
      </div>

      <div className={styles.history}>
        <button className={styles.historyButton} onClick={undo} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
          <Undo2 size={16} />
        </button>
        <button className={styles.historyButton} onClick={redo} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)">
          <Redo2 size={16} />
        </button>
      </div>

      <span className={styles.offline} title="La aplicación no puede hacer peticiones de red">
        <span className={styles.offlineDot} aria-hidden />
        100% local
      </span>
    </header>
  );
}
