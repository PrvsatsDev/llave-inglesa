import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, type CSSProperties } from 'react';
import { Canvas } from './components/Canvas.tsx';
import { Dialogs } from './components/Dialogs.tsx';
import { Header } from './components/Header.tsx';
import { MobileTabs } from './components/MobileTabs.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { useLiveAnalysis } from './store/analysis.ts';
import { hasLocalDocument, openLocal, saveLocal, showWelcome } from './storage/actions.ts';
import { useDialog } from './store/dialog.ts';
import { hasUnsavedChanges, useDocument } from './store/document.ts';
import { useLayout } from './store/layout.ts';
import { useMobile, useNarrow } from './store/mobile.ts';
import { goBack } from './store/navigation.ts';
import styles from './App.module.css';

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Atajos globales: deshacer/rehacer, guardar y Esc para volver. */
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
        // Lo mismo que "volver": cierra la ficha, regresa a la lista o sale de la simulación.
        goBack();
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

/**
 * Al arrancar (una sola vez): si hay un esquema guardado en este navegador, ofrece abrirlo; si no,
 * en la primera visita, la bienvenida.
 */
let started = false;
function useOnStart() {
  useEffect(() => {
    if (started) return;
    started = true;
    if (hasLocalDocument()) void openLocal();
    else if (!useLayout.getState().welcomeSeen) void showWelcome();
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
  useOnStart();
  useUnsavedGuard();
  useLiveAnalysis();
  const width = useLayout((s) => s.width);
  // En pantalla estrecha la columna no se pliega: panel y mapa van en pestañas.
  // Los dos hooks siempre, nunca tras un `&&`: si no, plegar cambia cuántos hooks llama App y React falla.
  const foldPreference = useLayout((s) => s.collapsed);
  const narrow = useNarrow();
  const collapsed = foldPreference && !narrow;
  const view = useMobile((s) => s.view);
  return (
    <ReactFlowProvider>
      {/* Plegada, el ancho lo pone la clase: el estilo en línea tendría prioridad sobre ella. */}
      <div
        className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}
        data-view={view}
        style={collapsed ? undefined : ({ '--panel-width': `${width}px` } as CSSProperties)}
      >
        <Header />
        <Sidebar />
        <Canvas />
        <MobileTabs />
      </div>
      <Dialogs />
    </ReactFlowProvider>
  );
}
