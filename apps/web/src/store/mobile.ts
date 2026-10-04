import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { useDocument } from './document.ts';
import { useScenario } from './scenario.ts';

/** Hasta este ancho, panel y mapa no caben juntos: se ven de uno en uno, con pestañas abajo (lo mismo que el CSS). */
export const NARROW_QUERY = '(max-width: 900px)';

const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW_QUERY) : null);

/** Si la pantalla es estrecha (móvil o tableta en vertical); se actualiza al girarla o cambiar de tamaño. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = media();
      m?.addEventListener('change', onChange);
      return () => m?.removeEventListener('change', onChange);
    },
    () => media()?.matches ?? false,
  );
}

export type MobileView = 'panel' | 'map';

interface MobileState {
  /** Qué se ve en pantalla estrecha. En pantalla grande se ven los dos y esto no cuenta. */
  view: MobileView;
  /** El mapa ha cambiado (otra simulación, otro documento) mientras se miraba el panel. */
  mapChanged: boolean;
  show(view: MobileView): void;
}

/** Pestañas Panel / Mapa de pantalla estrecha. No es parte del documento ni del historial. */
export const useMobile = create<MobileState>()((set) => ({
  view: 'panel',
  mapChanged: false,
  show: (view) => set(view === 'map' ? { view, mapChanged: false } : { view }),
}));

/** Marca el mapa como cambiado si no se está viendo: la pestaña lo avisa, pero no salta sola. */
function markMapChanged() {
  if (useMobile.getState().view === 'panel') useMobile.setState({ mapChanged: true });
}

useScenario.subscribe((s, prev) => {
  if (s.active !== prev.active && s.active !== null) markMapChanged();
});
useDocument.subscribe((s, prev) => {
  if (s.generation !== prev.generation) markMapChanged();
});

/** Tocar algo del mapa abre su ficha en el panel: en pantalla estrecha hay que pasar a verlo. */
export const showPanel = () => useMobile.getState().show('panel');
