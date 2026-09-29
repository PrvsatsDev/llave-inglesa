import { ReactFlowProvider } from '@xyflow/react';
import { useEffect } from 'react';
import { Canvas } from './components/Canvas.tsx';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { useLiveAnalysis } from './store/analysis.ts';
import { useDocument } from './store/document.ts';
import { useSelection } from './store/selection.ts';
import styles from './App.module.css';

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Atajos globales: deshacer/rehacer y Esc para cerrar el inspector. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useSelection.getState().select(null);
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

export function App() {
  useShortcuts();
  useLiveAnalysis();
  return (
    <ReactFlowProvider>
      <div className={styles.shell}>
        <Header />
        <Canvas />
        <Sidebar />
      </div>
    </ReactFlowProvider>
  );
}
