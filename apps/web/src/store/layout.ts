import { create } from 'zustand';

export const PANEL_MIN = 400;
export const PANEL_MAX = 720;
export const PANEL_DEFAULT = 480;

const STORAGE_KEY = 'llave-inglesa:panel';

interface LayoutState {
  /** Ancho de la columna izquierda, en px. */
  width: number;
  /** Plegada a una barra estrecha con solo las puntuaciones. */
  collapsed: boolean;
  setWidth(width: number): void;
  setCollapsed(collapsed: boolean): void;
}

export const clampWidth = (w: number) => Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, w)));

/** Preferencia de este navegador; si no hay almacenamiento, se usan los valores por defecto. */
function load(): Pick<LayoutState, 'width' | 'collapsed'> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<LayoutState> | null;
    return {
      width: typeof saved?.width === 'number' ? clampWidth(saved.width) : PANEL_DEFAULT,
      collapsed: saved?.collapsed === true,
    };
  } catch {
    return { width: PANEL_DEFAULT, collapsed: false };
  }
}

function save({ width, collapsed }: LayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, collapsed }));
  } catch {
    // Sin almacenamiento la preferencia solo dura esta sesión.
  }
}

/** Disposición de la interfaz. No es parte del documento ni del historial. */
export const useLayout = create<LayoutState>()((set, get) => ({
  ...load(),
  setWidth: (width) => {
    set({ width: clampWidth(width) });
    save(get());
  },
  setCollapsed: (collapsed) => {
    set({ collapsed });
    save(get());
  },
}));
