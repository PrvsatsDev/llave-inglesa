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
  /** Ya se cerró el aviso de que en móvil se trabaja peor. */
  mobileNoticeDismissed: boolean;
  /** Ya se vio la bienvenida de la primera visita. */
  welcomeSeen: boolean;
  setWidth(width: number): void;
  setCollapsed(collapsed: boolean): void;
  dismissMobileNotice(): void;
  markWelcomeSeen(): void;
}

export const clampWidth = (w: number) => Math.round(Math.min(PANEL_MAX, Math.max(PANEL_MIN, w)));

type Prefs = Pick<LayoutState, 'width' | 'collapsed' | 'mobileNoticeDismissed' | 'welcomeSeen'>;

/** Preferencia de este navegador; si no hay almacenamiento, se usan los valores por defecto. */
function load(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<LayoutState> | null;
    return {
      width: typeof saved?.width === 'number' ? clampWidth(saved.width) : PANEL_DEFAULT,
      collapsed: saved?.collapsed === true,
      mobileNoticeDismissed: saved?.mobileNoticeDismissed === true,
      welcomeSeen: saved?.welcomeSeen === true,
    };
  } catch {
    return { width: PANEL_DEFAULT, collapsed: false, mobileNoticeDismissed: false, welcomeSeen: false };
  }
}

function save({ width, collapsed, mobileNoticeDismissed, welcomeSeen }: LayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, collapsed, mobileNoticeDismissed, welcomeSeen }));
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
  dismissMobileNotice: () => {
    set({ mobileNoticeDismissed: true });
    save(get());
  },
  markWelcomeSeen: () => {
    set({ welcomeSeen: true });
    save(get());
  },
}));
