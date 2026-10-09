import { ChevronDown, Redo2, Undo2 } from 'lucide-react';
import { EXAMPLE_GROUPS, examples } from '../lib/examples.ts';
import { keyColor } from '../lib/key-colors.ts';
import { policyText, UI } from '../lib/text.ts';
import { loadExample } from '../storage/actions.ts';
import { aboutDialog } from '../store/dialog.ts';
import { hasUnsavedChanges, useDocument, type DocumentOrigin } from '../store/document.ts';
import { FileMenu } from './FileMenu.tsx';
import { KeyChip } from './KeyChip.tsx';
import styles from './Header.module.css';

const CURRENT = '__actual';
const T = UI.cabecera;

function originText(origin: DocumentOrigin): string {
  switch (origin.kind) {
    case 'example': return T.origen.ejemplo;
    case 'new': return T.origen.nuevo;
    case 'file': return origin.name;
    case 'local': return T.origen.local;
  }
}

/** Estado de guardado, siempre con texto (no solo color). */
function SaveStatus() {
  const origin = useDocument((s) => s.origin);
  const dirty = useDocument(hasUnsavedChanges);
  if (origin.kind === 'example' && !dirty) return null;
  const state = dirty ? 'dirty' : 'saved';
  return (
    <span className={`${styles.status} ${styles[state]}`} title={dirty ? T.pistaGuardar : undefined}>
      <span className={styles.statusDot} aria-hidden />
      {dirty ? T.sinGuardar : T.guardado}
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
      <button className={styles.brand} onClick={() => void aboutDialog()} title={T.acercaDe} aria-label={T.acercaDe}>
        <img className={styles.logo} src="/logo.svg" alt="" width={28} height={28} />
        <span className={styles.wordmark}>llave-inglesa</span>
      </button>

      <div className={styles.divider} aria-hidden />

      <FileMenu />

      <label className={styles.select}>
        <select value={value} onChange={(e) => void loadExample(e.target.value)} aria-label={T.documentoAbierto}>
          {origin.kind !== 'example' && (
            <option value={CURRENT}>
              {model.name} ({originText(origin)})
            </option>
          )}
          {EXAMPLE_GROUPS.map((group) => (
            <optgroup key={group} label={T.gruposEjemplos[group]}>
              {examples
                .filter((e) => e.group === group)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.model.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown size={14} className={styles.chevron} aria-hidden />
      </label>

      <SaveStatus />

      <div className={styles.policy}>
        <span className={styles.policyLabel}>{T.politica}</span>
        <span className={styles.policyValue}>{policyText(model.policy, label)}</span>
        <span className={styles.keys}>
          {model.keys.map((k) => (
            <KeyChip key={k.id} label={k.label} color={keyColor(model, k.id)} />
          ))}
        </span>
      </div>

      <div className={styles.history}>
        <button className={styles.historyButton} onClick={undo} disabled={!canUndo} aria-label={T.deshacer} title={T.pistaDeshacer}>
          <Undo2 size={16} />
        </button>
        <button className={styles.historyButton} onClick={redo} disabled={!canRedo} aria-label={T.rehacer} title={T.pistaRehacer}>
          <Redo2 size={16} />
        </button>
      </div>

      <span className={styles.offline} title={T.pistaLocal} aria-label={T.localAccesible}>
        <span className={styles.offlineDot} aria-hidden />
        <span className={styles.offlineText}>{T.local}</span>
      </span>
    </header>
  );
}
