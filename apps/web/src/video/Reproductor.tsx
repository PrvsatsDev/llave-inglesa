import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Portada } from './Portada.tsx';
import { DURACION, ESCENAS, escenaEn, inicioDe, sonidosDelVideo } from './escenas.tsx';
import { renderizarAudio, wavBase64 } from './sonido.ts';
import { ALTO, ANCHO, FPS } from './tiempo.ts';
import styles from './video.module.css';

declare global {
  interface Window {
    /** Pinta un fotograma del vídeo y resuelve cuando ya está en pantalla (lo usan el render y el reproductor). */
    __fotograma?: (f: number) => Promise<void>;
    __duracion?: number;
    /** Para el render: tramo de una escena, y el audio (WAV en base64) de un tramo. */
    __tramo?: (escena: string) => { desde: number; fotogramas: number };
    __audio?: (desde: number, fotogramas: number) => Promise<string>;
  }
}

/**
 * Página de vídeo (solo en desarrollo). Con ?render: el lienzo a 1920×1080 exactos, que scripts/video.ts
 * captura fotograma a fotograma. Sin él: un reproductor para revisar, con ese mismo lienzo dentro de un
 * iframe a tamaño real (reducirlo con CSS por fuera no altera cómo mide React Flow los nodos).
 * Con ?portada: la imagen de vista previa del enlace (scripts/portada.ts).
 */
export function Reproductor() {
  const params = new URLSearchParams(location.search);
  if (params.has('portada')) return <Portada />;
  return params.has('render') ? <Lienzo /> : <Revision />;
}

function Lienzo() {
  const [f, setF] = useState(0);
  useEffect(() => {
    window.__duracion = DURACION;
    window.__tramo = (id) => ({ desde: inicioDe(id), fotogramas: ESCENAS.find((e) => e.id === id)!.fotogramas });
    window.__audio = async (desde, fotogramas) => wavBase64(await renderizarAudio(sonidosDelVideo(), desde, fotogramas));
    window.__fotograma = (n) => {
      flushSync(() => setF(n));
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    };
  }, []);
  const { escena, local } = escenaEn(f);
  return (
    <div className={styles.lienzo} style={{ width: ANCHO, height: ALTO }}>
      <escena.Componente f={local} />
    </div>
  );
}

function Revision() {
  const marco = useRef<HTMLIFrameElement>(null);
  const [f, setF] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);

  useEffect(() => {
    void marco.current?.contentWindow?.__fotograma?.(f);
  }, [f]);
  useEffect(() => {
    if (!reproduciendo) return;
    const t = setInterval(() => setF((x) => (x + 1) % DURACION), 1000 / FPS);
    return () => clearInterval(t);
  }, [reproduciendo]);

  const escala = Math.min((window.innerWidth - 48) / ANCHO, (window.innerHeight - 140) / ALTO);
  const { escena, local } = escenaEn(f);
  return (
    <div className={styles.reproductor}>
      <div style={{ width: ANCHO * escala, height: ALTO * escala }}>
        <iframe
          ref={marco}
          className={styles.marco}
          src="/video.html?render"
          title="Lienzo del vídeo"
          width={ANCHO}
          height={ALTO}
          style={{ transform: `scale(${escala})` }}
          onLoad={() => setTimeout(() => void marco.current?.contentWindow?.__fotograma?.(f), 300)}
        />
      </div>
      <div className={styles.controles}>
        <button onClick={() => setReproduciendo(!reproduciendo)} aria-label={reproduciendo ? 'Pausa' : 'Reproducir'}>
          {reproduciendo ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <input
          type="range"
          min={0}
          max={DURACION - 1}
          value={f}
          onChange={(e) => {
            setReproduciendo(false);
            setF(Number(e.target.value));
          }}
          aria-label="Fotograma"
        />
        <span className={styles.contador}>
          {escena.titulo} ({local}) · {String(f).padStart(3, '0')} / {DURACION - 1} · {(f / FPS).toFixed(2)} s
        </span>
      </div>
    </div>
  );
}
