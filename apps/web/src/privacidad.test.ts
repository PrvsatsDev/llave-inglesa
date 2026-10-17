import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guardián: el navegador no debe sacar el esquema por su cuenta. La página no se traduce (la traducción envía su
 * texto, con el descriptor y los nombres, a un servidor) y todo campo de texto lleva `{...PRIVADO}` (sin corrector,
 * autocompletado ni Grammarly/LanguageTool; ver `lib/privacidad.ts`). Las contraseñas, ficheros, números, casillas y
 * deslizadores no llevan texto que filtrar.
 */

const ROOT = new URL('.', import.meta.url).pathname;
const SIN_TEXTO = /\btype=["'](password|file|number|checkbox|range)["']/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return files(path);
    return e.name.endsWith('.tsx') ? [path] : [];
  });
}

/** Cada `<input …>` y `<textarea …>`, hasta el `>` que cierra la etiqueta (sin contar los de dentro de `{…}`). */
function fields(source: string): { line: number; tag: string }[] {
  const out: { line: number; tag: string }[] = [];
  for (const m of source.matchAll(/<(input|textarea)\b/g)) {
    let depth = 0;
    let end = m.index;
    for (; end < source.length; end++) {
      const c = source[end];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ line: source.slice(0, m.index).split('\n').length, tag: source.slice(m.index, end + 1) });
  }
  return out;
}

describe('privacidad en el navegador', () => {
  it('las páginas piden no traducirse', () => {
    for (const page of ['index.html', 'video.html']) {
      const html = readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
      expect(html, page).toMatch(/<html [^>]*translate="no"/);
      expect(html, page).toContain('<meta name="google" content="notranslate" />');
    }
  });

  it('el guardián encuentra los campos y sus atributos', () => {
    const found = fields('<input\n  value={x}\n  onChange={(e) => set(e.target.value)}\n  {...PRIVADO}\n/>\n<textarea rows={3} />');
    expect(found.map((f) => f.line)).toEqual([1, 6]);
    expect(found[0]!.tag).toContain('{...PRIVADO}');
    expect(found[1]!.tag).toBe('<textarea rows={3} />');
  });

  it('todo campo de texto lleva {...PRIVADO}', () => {
    const missing = files(ROOT).flatMap((path) =>
      fields(readFileSync(path, 'utf8'))
        .filter(({ tag }) => !SIN_TEXTO.test(tag) && !tag.includes('{...PRIVADO}'))
        .map(({ line }) => `${relative(ROOT, path)}:${line}`),
    );
    expect(missing).toEqual([]);
  });
});
