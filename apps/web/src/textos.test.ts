import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guardián: los textos de la interfaz viven en `packages/text` (UI), no en los componentes, para poder
 * traducirlos. Heurístico, sin parser: busca texto suelto en el JSX, atributos de texto con literales y
 * cadenas que parecen frases o etiquetas. Una línea que de verdad lo necesite (un dato del modelo, una
 * marca) lleva el comentario `texto-ok` con el motivo.
 */

const ROOT = new URL('.', import.meta.url).pathname;
/** El vídeo es una pieza en español aparte; los tests y los estilos no son interfaz. */
const SKIP = ['video/', 'main.tsx', 'textos.test.ts'];
/** Nombres de teclas y valores de atributos que no son texto. */
const NOT_TEXT = new Set(['Enter', 'Escape', 'Home', 'End', 'Tab', 'noopener noreferrer']);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return files(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [path] : [];
  });
}

const WORD = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/;
/** Texto JSX de una sola palabra en minúsculas (`<span>abierto</span>`): sin espacios, se escaparía de `looksLikeText`. */
const JSX_WORD = />\s*([a-záéíóúñ]{3,})\s*</g;
/** Una cadena es texto si tiene letras con espacios entre palabras, tildes o ñ, o es una palabra con mayúscula inicial. */
/** En las plantillas, lo interpolado cuenta como una palabra cualquiera: `Vía ${n} de ${total}` sigue siendo texto. */
const looksLikeText = (raw: string) => {
  const s = raw.replace(/\$\{[^}]*\}/g, 'x');
  return WORD.test(s) && !NOT_TEXT.has(s) && (/(?<![\w-])[A-Za-záéíóúñ]{2,}[,:]? +[¿¡(«"]?[A-Za-záéíóúñ]{2,}(?![\w-])/.test(s) || /[ÁÉÍÓÚÑáéíóúñ¿¡]/.test(s) || /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(s));
};

function findings(source: string, jsx: boolean): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  source.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*(\*|\/\*\*?).*$/, '');
    if (line.includes('texto-ok') || !code.trim()) return;
    const hits = [
      // Texto suelto entre etiquetas JSX (o al principio de la línea, dentro de un bloque JSX).
      ...(jsx ? [...code.matchAll(/>([^<>{}]*)</g)].map((m) => m[1]!) : []),
      ...(jsx && /^\s*[¿¡A-ZÁÉÍÓÚa-záéíóúñ][^=;(){}<>]*$/.test(code) && !/^\s*(import|export|return|const|let|type|interface|case|default|else|if|for|while|function|async|await|break)\b/.test(code) && !/^\s*[\w$]+\??\s*:/.test(code) ? [code] : []),
      // Atributos de texto con un literal.
      ...[...code.matchAll(/\b(?:aria-label|title|placeholder|alt|label)="([^"]*)"/g)].map((m) => m[1]!),
      // Cadenas en el código.
      ...[...code.matchAll(/'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`|"((?:[^"\\]|\\.)*)"/g)].map((m) => (m[1] ?? m[2] ?? m[3])!),
    ]
      .filter((t) => looksLikeText(t.trim()))
      .concat(jsx ? [...code.matchAll(JSX_WORD)].map((m) => m[1]!) : []);
    if (hits.length) out.push({ line: i + 1, text: hits[0]!.trim() });
  });
  return out;
}

describe('textos de la interfaz', () => {
  it('el guardián reconoce textos y deja pasar lo que no lo es', () => {
    const tsx = (line: string) => findings(line, true).length > 0;
    for (const line of [
      '<p>Guardado</p>',
      '<span>abierto</span>',
      '<button title="Volver (Esc)">',
      'label: `Vía ${n} de ${total}`,',
      "const t = 'Sin nombre';",
      "label: 'Débil',",
      '        Pensada para pantalla grande.',
    ])
      expect(tsx(line), line).toBe(true);
    for (const line of [
      '<p>{T.guardado}</p>',
      "const k = 'device-rng';",
      'className={`${styles.a} ${styles.b}`}',
      'className={`edge-reached edge-reached-${tone}`}',
      "if (e.key === 'Escape') close();",
      "const x = 'Hola'; // texto-ok: motivo",
      '  score: sec.score,',
    ])
      expect(tsx(line), line).toBe(false);
  });

  it('no hay textos escritos en los componentes', () => {
    const found = files(ROOT)
      .filter((f) => !SKIP.some((s) => relative(ROOT, f).startsWith(s)))
      .flatMap((f) => findings(readFileSync(f, 'utf8'), f.endsWith('.tsx')).map((h) => `${relative(ROOT, f)}:${h.line}  ${h.text}`));
    expect(found).toEqual([]);
  });
});
