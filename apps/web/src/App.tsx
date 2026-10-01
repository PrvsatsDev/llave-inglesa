import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, type CSSProperties } from 'react';
import { Canvas } from './components/Canvas.tsx';
import { Dialogs } from './components/Dialogs.tsx';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { useLiveAnalysis } from './store/analysis.ts';
import { hasLocalDocument, openLocal, saveLocal } from './storage/actions.ts';
import { useDialog } from './store/dialog.ts';
import { hasUnsavedChanges, useDocument } from './store/document.ts';
import { useLayout } from './store/layout.ts';
import { useScenario } from './store/scenario.ts';
import { useSelection } from './store/selection.ts';
import styles from './App.module.css';

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Atajos globales: deshacer/rehacer, guardar y Esc para cerrar el inspector o la simulación. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Con un diálogo abierto, las teclas son suyas.
      if (useDialog.getState().current) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveLocal();
        return;
      }
      if (e.key === 'Escape') {
        // Primero se cierra la ficha abierta; si no hay ninguna, se sale de la simulación.
        const selection = useSelection.getState();
        if (selection.selected) selection.select(null);
        else useScenario.getState().set(null);
        return;
      }
      // Dentro de un campo de texto, Ctrl+Z es el deshacer nativo del campo.
      if (isEditable(e.target) || !(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useDocument.getState().undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        useDocument.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Al arrancar, si hay un esquema guardado en este navegador, ofrece abrirlo (una sola vez). */
let offeredSaved = false;
function useOpenSavedOnStart() {
  useEffect(() => {
    if (offeredSaved || !hasLocalDocument()) return;
    offeredSaved = true;
    void openLocal();
  }, []);
}

/** Avisa antes de cerrar la pestaña si hay cambios sin guardar. */
function useUnsavedGuard() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges(useDocument.getState())) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
}

export function App() {
  useShortcuts();
  useOpenSavedOnStart();
  useUnsavedGuard();
  useLiveAnalysis();
  const width = useLayout((s) => s.width);
  const collapsed = useLayout((s) => s.collapsed);
  return (
    <ReactFlowProvider>
      {/* Plegada, el ancho lo pone la clase: el estilo en línea tendría prioridad sobre ella. */}
      <div
        className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}
        style={collapsed ? undefined : ({ '--panel-width': `${width}px` } as CSSProperties)}
      >
        <Header />
        <Sidebar />
        <Canvas />
      </div>
      <Dialogs />
    </ReactFlowProvider>
  );
}
