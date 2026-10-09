import { AlertOctagon, Download, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { UI } from '../lib/text.ts';
import { rescueDownload } from '../storage/actions.ts';
import { hasUnsavedChanges, useDocument } from '../store/document.ts';
import styles from './Crash.module.css';

const T = UI.marco.fallo;

interface State {
  error: Error | null;
}

/**
 * Si la interfaz falla, en vez de una pantalla en blanco: qué ha pasado y cómo no perder el esquema.
 * El documento sigue en memoria (su store no depende de React), así que se puede descargar.
 */
export class CrashBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Solo en la consola de este navegador: la app no envía nada a ningún sitio.
    console.error('llave-inglesa: fallo de la interfaz', error, info.componentStack); // texto-ok: solo en la consola
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const unsaved = hasUnsavedChanges(useDocument.getState());
    return (
      <main className={styles.crash} role="alert">
        <div className={styles.card}>
          <AlertOctagon size={28} className={styles.icon} aria-hidden />
          <h1 className={styles.title}>{T.titulo}</h1>
          <p className={styles.text}>
            {T.noEsTuEsquema} {unsaved ? T.conCambios : T.sinCambios}
          </p>
          <div className={styles.actions}>
            <button className={unsaved ? styles.primary : styles.secondary} onClick={rescueDownload}>
              <Download size={14} aria-hidden /> {T.descargar}
            </button>
            <button className={unsaved ? styles.secondary : styles.primary} onClick={() => window.location.reload()}>
              <RotateCcw size={14} aria-hidden /> {T.recargar}
            </button>
          </div>
          <p className={styles.note}>
            {T.nota}
          </p>
          <details className={styles.details}>
            <summary>{T.detalle}</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </main>
    );
  }
}
