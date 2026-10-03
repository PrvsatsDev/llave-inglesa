import { ChevronDown, Download, FilePlus2, FolderOpen, HardDriveDownload, Info, Lock, Save, Trash2, Unlock, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { exportEncrypted, exportPlain, forgetLocal, hasLocalDocument, importFile, newDocument, openLocal, saveLocal } from '../storage/actions.ts';
import { aboutDialog } from '../store/dialog.ts';
import { APP_VERSION } from '../version.ts';
import styles from './FileMenu.module.css';

interface Item {
  icon: LucideIcon;
  label: string;
  hint?: string;
  shortcut?: string;
  danger?: boolean;
  run(): void;
}

/** Menú Archivo: todo ocurre en local, nada sale del navegador. */
export function FileMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Al abrirse, el foco pasa a la primera opción (como en cualquier menú).
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  /** Flechas, Inicio y Fin recorren las opciones; Esc cierra y vuelve al botón; Tab cierra y sigue. */
  const onMenuKey = (e: KeyboardEvent) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      e.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'Escape') {
      // Que no llegue al Esc global ("volver").
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const stored = hasLocalDocument();
  const groups: Item[][] = [
    [
      { icon: FilePlus2, label: 'Nuevo esquema', run: newDocument },
      { icon: FolderOpen, label: 'Abrir fichero…', hint: '.llave o .json', run: () => fileRef.current?.click() },
      ...(stored ? [{ icon: Unlock, label: 'Abrir guardado del navegador', run: openLocal }] : []),
    ],
    [
      { icon: Save, label: 'Guardar en este navegador', hint: 'cifrado', shortcut: 'Ctrl+S', run: saveLocal },
      { icon: Lock, label: 'Exportar cifrado…', hint: '.llave', run: exportEncrypted },
      { icon: HardDriveDownload, label: 'Exportar sin cifrar…', hint: '.json', run: exportPlain },
    ],
    ...(stored ? [[{ icon: Trash2, label: 'Borrar guardado del navegador', danger: true, run: forgetLocal }]] : []),
    [{ icon: Info, label: 'Acerca de llave-inglesa', run: () => void aboutDialog() }],
  ];

  return (
    <div className={styles.wrap} ref={menuRef}>
      <button
        ref={triggerRef}
        className={styles.trigger}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Archivo"
      >
        <Download size={14} aria-hidden /> <span className={styles.triggerText}>Archivo</span> <ChevronDown size={13} aria-hidden />
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label="Archivo" ref={listRef} onKeyDown={onMenuKey}>
          {groups.map((group, g) => (
            <div key={g} className={styles.group}>
              {group.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                  onClick={() => {
                    setOpen(false);
                    item.run();
                  }}
                >
                  <item.icon size={14} aria-hidden />
                  <span className={styles.label}>{item.label}</span>
                  {item.hint && <span className={styles.hint}>{item.hint}</span>}
                  {item.shortcut && <kbd className={styles.kbd}>{item.shortcut}</kbd>}
                </button>
              ))}
            </div>
          ))}
          <p className={styles.footer}>
            Todo ocurre en tu equipo: nada se envía a ningún servidor. <span className={styles.version}>v{APP_VERSION}</span>
          </p>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".llave,.json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void importFile(file);
        }}
      />
    </div>
  );
}
