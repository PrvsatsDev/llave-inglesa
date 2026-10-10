import { describe, expect, it } from 'vitest';
import * as fachada from '../src/index.ts';
import { detectarIdioma } from '../src/idioma.ts';
import * as es from '../src/es/index.ts';
import { vivo } from '../src/vivo.ts';

describe('objeto vivo', () => {
  const A = { titulo: 'Hola', n: (x: number) => `${x} cosas`, zona: { lista: ['uno', 'dos'], sub: { t: 'a' } } };
  const B = { titulo: 'Hello', n: (x: number) => `${x} things`, zona: { lista: ['one', 'two'], sub: { t: 'b' } } };
  let actual = A;
  const V = vivo(() => actual);

  it('lo guardado al cargar sigue al idioma activo: objetos, funciones y arrays', () => {
    actual = A;
    const zona = V.zona;
    const n = V.n;
    expect([V.titulo, n(2), zona.lista.join(), zona.sub.t, [...zona.lista].length]).toEqual(['Hola', '2 cosas', 'uno,dos', 'a', 2]);
    actual = B;
    expect([V.titulo, n(2), zona.lista.join(), zona.sub.t]).toEqual(['Hello', '2 things', 'one,two', 'b']);
    expect(zona.lista.map((s) => s.toUpperCase())).toEqual(['ONE', 'TWO']);
  });

  it('se comporta como el original: claves, entradas, arrays e identidad estable', () => {
    actual = A;
    expect(Object.keys(V.zona)).toEqual(['lista', 'sub']);
    expect(Object.entries(V.zona.sub)).toEqual([['t', 'a']]);
    expect(Array.isArray(V.zona.lista)).toBe(true);
    expect({ ...V.zona.sub }).toEqual({ t: 'a' });
    expect(V.zona).toBe(V.zona);
    expect(V.n).toBe(V.n);
  });
});

describe('fachada de textos', () => {
  it('exporta todo lo de cada idioma, y nada es una cadena suelta (no seguiría al idioma)', () => {
    for (const [nombre, valor] of Object.entries(es)) {
      expect(fachada, nombre).toHaveProperty(nombre);
      expect(typeof valor, nombre).not.toBe('string');
    }
  });

  it('detecta el idioma del navegador; sin coincidencia, inglés si lo hay o español', () => {
    expect(detectarIdioma(['es-ES', 'en'])).toBe('es');
    expect(detectarIdioma(['ES'])).toBe('es');
    expect(detectarIdioma(['fr-FR', 'es'])).toBe('es');
    expect(detectarIdioma(['fr-FR'])).toBe(fachada.IDIOMAS.includes('en' as never) ? 'en' : 'es');
  });
});
