import { AlertOctagon, Download, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { rescueDownload } from '../storage/actions.ts';
import { hasUnsavedChanges, useDocument } from '../store/document.ts';
import styles from './Crash.module.css';

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
    console.error('llave-inglesa: fallo de la interfaz', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const unsaved = hasUnsavedChanges(useDocument.getState());
    return (
      <main className={styles.crash} role="alert">
        <div className={styles.card}>
          <AlertOctagon size={28} className={styles.icon} aria-hidden />
          <h1 className={styles.title}>Algo ha fallado en la interfaz</h1>
          <p className={styles.text}>
            Es un fallo de la aplicación, no de tu esquema. {unsaved ? 'Tienes cambios sin guardar: descárgalos antes de recargar.' : 'Tu esquema no tiene cambios sin guardar.'}
          </p>
          <div className={styles.actions}>
            <button className={unsaved ? styles.primary : styles.secondary} onClick={rescueDownload}>
              <Download size={14} aria-hidden /> Descargar el esquema (.json)
            </button>
            <button className={unsaved ? styles.secondary : styles.primary} onClick={() => window.location.reload()}>
              <RotateCcw size={14} aria-hidden /> Recargar
            </button>
          </div>
          <p className={styles.note}>
            El fichero va sin cifrar: guárdalo en un sitio seguro, ábrelo con «Abrir fichero…» y bórralo después.
          </p>
          <details className={styles.details}>
            <summary>Detalle técnico</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </main>
    );
  }
}
