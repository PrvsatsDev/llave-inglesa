import { create } from 'zustand';
import { detectarIdioma, IDIOMAS, setIdioma, type Idioma } from '../lib/text.ts';

const STORAGE_KEY = 'llave-inglesa:idioma';

/** El elegido en este navegador; si no hay, el del navegador (español si lo prefiere; si no, inglés). */
function inicial(): Idioma {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (guardado && (IDIOMAS as string[]).includes(guardado)) return guardado as Idioma;
  } catch {
    // sin almacenamiento: se detecta cada vez
  }
  return detectarIdioma(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

function aplicar(idioma: Idioma) {
  setIdioma(idioma);
  document.documentElement.lang = idioma;
}

interface IdiomaState {
  idioma: Idioma;
  cambiar(idioma: Idioma): void;
}

/**
 * Idioma de la interfaz. Los textos de `packages/text` siguen al idioma activo; al cambiarlo, App vuelve a montar
 * la interfaz entera para que todo se pinte de nuevo. El documento, la simulación y la navegación viven en sus
 * stores, fuera de React, y se conservan.
 */
export const useIdioma = create<IdiomaState>()((set) => {
  const idioma = inicial();
  aplicar(idioma);
  return {
    idioma,
    cambiar(idioma) {
      aplicar(idioma);
      try {
        localStorage.setItem(STORAGE_KEY, idioma);
      } catch {
        // la preferencia no se recordará, pero el cambio vale para esta sesión
      }
      set({ idioma });
    },
  };
});
