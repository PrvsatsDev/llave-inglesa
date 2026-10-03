import { scoreBand } from '@llave-inglesa/engine';
import { CIFRAS } from './guia-cifras.ts';
import { GUIA, type Bloque, type Trozo } from './guia.ts';
import { SCORE_BAND_TEXT } from './index.ts';

const URL_APP = 'https://llave-inglesa.vualt.net';

/**
 * La guía en Markdown (docs/GUIA.md), para leerla en GitHub. Los botones de la app pasan a ser
 * indicaciones; `nombres` da el nombre visible de cada ejemplo.
 */
export function guiaMarkdown(nombres: Readonly<Record<string, string>>): string {
  const texto = (trozos: readonly Trozo[]) =>
    trozos
      .map((t) => {
        if (typeof t === 'string') return t;
        if ('negrita' in t) return `**${t.negrita}**`;
        if ('enlace' in t) return `[${t.texto}](${t.enlace})`;
        if ('capitulo' in t) return `[${t.texto}](#${t.capitulo})`;
        const valor = CIFRAS[t.cifra.ejemplo]![t.cifra.metrica];
        return `**${valor}** (${SCORE_BAND_TEXT[scoreBand(valor)].toLowerCase()})`;
      })
      .join('');
  const ejemplo = (id: string) => `«${nombres[id] ?? id}»`;
  const bloque = (b: Bloque): string => {
    switch (b.tipo) {
      case 'parrafo':
        return texto(b.texto);
      case 'lista':
        return b.items.map((item) => `- ${texto(item)}`).join('\n');
      case 'nota':
        return `> 💡 ${texto(b.texto)}`;
      case 'ejemplo':
        return `> ▶ En la app: abre el ejemplo ${ejemplo(b.ejemplo)}.`;
      case 'simular':
        return `> ▶ En la app, con el ejemplo ${ejemplo(b.ejemplo)}: *${b.texto}*.`;
    }
  };
  const indice = GUIA.map((c, i) => `${i + 1}. [${c.titulo}](#${c.id}): ${c.resumen}`).join('\n');
  const capitulos = GUIA.map((c, i) => [`<a id="${c.id}"></a>`, `## ${i + 1}. ${c.titulo}`, ...c.bloques.map(bloque)].join('\n\n'));
  return `# Guía de uso

<!-- Generado por scripts/guia.ts desde packages/text/src/guia.ts: no editar a mano. -->

Esta guía también está dentro de la aplicación (${URL_APP}, menú *Archivo → Guía de uso*), donde es
interactiva: sus botones abren los ejemplos y simulan en el mapa. Las cifras son las que calcula el motor
en esta versión.

${indice}

${capitulos.join('\n\n')}
`;
}
