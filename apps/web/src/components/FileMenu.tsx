import { ChevronDown, Download, FilePlus2, FolderOpen, HardDriveDownload, Lock, Save, Trash2, Unlock, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { exportEncrypted, exportPlain, forgetLocal, hasLocalDocument, importFile, newDocument, openLocal, saveLocal } from '../storage/actions.ts';
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
  ];

  return (
    <div className={styles.wrap} ref={menuRef}>
      <button className={styles.trigger} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label="Archivo">
        <Download size={14} aria-hidden /> <span className={styles.triggerText}>Archivo</span> <ChevronDown size={13} aria-hidden />
      </button>
      {open && (
        <div className={styles.menu} role="menu">
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
          <p className={styles.footer}>Todo ocurre en tu equipo: nada se envía a ningún servidor.</p>
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
