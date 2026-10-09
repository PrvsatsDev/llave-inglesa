/** El idioma activo de los textos. Lo cambia la web (selector o detección); la CLI se queda en español. */

import * as es from './es/index.ts';

/** Todos los textos de un idioma. Cada idioma es una carpeta con exactamente esta forma. */
export type Textos = typeof es;

export const TEXTOS = { es } satisfies Record<string, Textos>;

export type Idioma = keyof typeof TEXTOS;
export const IDIOMAS = Object.keys(TEXTOS) as Idioma[];

let actual: Idioma = 'es';

export const idioma = () => actual;
export function setIdioma(i: Idioma) {
  actual = i;
}

/** El primero de los idiomas preferidos (p. ej. `navigator.languages`) que tengamos; si no, inglés, y si no, español. */
export function detectarIdioma(preferidos: readonly string[]): Idioma {
  for (const p of preferidos) {
    const base = p.slice(0, 2).toLowerCase();
    if ((IDIOMAS as string[]).includes(base)) return base as Idioma;
  }
  return (IDIOMAS as string[]).includes('en') ? ('en' as Idioma) : 'es';
}
