import type { AttackAtom, LossEvent } from '@llave-inglesa/engine';

/**
 * La guía de uso, como datos: la web la muestra al lado del mapa (con botones que abren ejemplos y
 * simulan) y scripts/guia.ts la convierte en docs/GUIA.md. Las cifras no se escriben: se citan
 * (`{ cifra }`) y salen de guia-cifras.ts, que genera el motor; un test comprueba que está al día.
 */

export type Metrica = 'security' | 'resilience' | 'usability' | 'inheritance';

/** Un trozo de texto: texto normal, en negrita, o la puntuación de un ejemplo en una métrica. */
export type Trozo = string | { negrita: string } | { cifra: { ejemplo: string; metrica: Metrica } };

export type Escenario = { kind: 'attack'; atoms: AttackAtom[] } | { kind: 'loss'; events: LossEvent[] };

export type Bloque =
  | { tipo: 'parrafo'; texto: Trozo[] }
  | { tipo: 'lista'; items: Trozo[][] }
  /** Recuadro destacado (una idea clave o un aviso). */
  | { tipo: 'nota'; texto: Trozo[] }
  /** Botón que abre un ejemplo. */
  | { tipo: 'ejemplo'; ejemplo: string; texto: string }
  /** Botón que abre un ejemplo (si no está abierto) y simula un escenario en el mapa. */
  | { tipo: 'simular'; ejemplo: string; escenario: Escenario; texto: string };

export interface Capitulo {
  id: string;
  titulo: string;
  /** Una línea para el índice. */
  resumen: string;
  bloques: Bloque[];
}

const cifra = (ejemplo: string, metrica: Metrica): Trozo => ({ cifra: { ejemplo, metrica } });
const n = (negrita: string): Trozo => ({ negrita });

const CASA = 'todo-en-casa';

export const GUIA: readonly Capitulo[] = [
  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos',
    resumen: 'Cinco minutos con un ejemplo: las cuatro notas, el mapa y tu primera simulación.',
    bloques: [
      {
        tipo: 'parrafo',
        texto: [
          'Empieza con un esquema ya montado: un multisig 2 de 3 en el que casi todo está en casa. Es cómodo, y justo por eso tiene puntos débiles que se ven enseguida.',
        ],
      },
      { tipo: 'ejemplo', ejemplo: CASA, texto: 'Abrir «Todo a mano en casa»' },
      {
        tipo: 'parrafo',
        texto: [n('Las cuatro notas'), ', arriba en esta columna, resumen el esquema de 0 a 100:'],
      },
      {
        tipo: 'lista',
        items: [
          [n('Seguridad'), ' (', cifra(CASA, 'security'), '): lo que le cuesta a un atacante robarte por la vía más barata.'],
          [n('Resiliencia'), ' (', cifra(CASA, 'resilience'), '): lo improbable que es perderlo todo por desgracias (un incendio, perder una placa, olvidar algo…).'],
          [n('Usabilidad'), ' (', cifra(CASA, 'usability'), '): a cuántos sitios tienes que ir para firmar.'],
          [n('Herencia'), ' (', cifra(CASA, 'inheritance'), '): si tus herederos llegarían a los fondos, y lo frágil que es ese camino.'],
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Más adelante, fuera de la guía, puedes pulsar cualquier nota para ver de dónde sale: la base, lo que se le resta y, plegado, cómo se calcula. Si sales, ',
          n('Archivo → Guía de uso'),
          ' te devuelve a este mismo punto.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          n('El mapa'),
          ' tiene arriba las ubicaciones, con lo que hay en cada una (dispositivos y backups) y las keys que guardan (K1, K2, K3). Abajo, las personas con lo que saben de memoria. Las líneas dicen quién puede entrar dónde; las discontinuas, solo tras un fallecimiento.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [n('Tu primera simulación'), ': ¿cuál es la forma más barata de robar este esquema?'],
      },
      {
        tipo: 'simular',
        ejemplo: CASA,
        escenario: { kind: 'attack', atoms: [{ type: 'coercion', person: 'yo', location: 'casa' }] },
        texto: 'Simular una llave inglesa a Yo en Casa',
      },
      {
        tipo: 'parrafo',
        texto: [
          'En rojo, lo que usa el atacante: obligado a dar el PIN, Yo desbloquea la Coldcard (K1), y la placa de K2 está en el mismo sitio. Dos de tres: puede gastar. Es una sola acción, y por eso la seguridad se queda en ',
          cifra(CASA, 'security'),
          '.',
        ],
      },
      {
        tipo: 'nota',
        texto: [
          'La pestaña ',
          n('Simular'),
          ' explica siempre ',
          n('por qué'),
          ': cada firma, cada secreto y de dónde lo saca el atacante.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: ['Ahora una desgracia: un incendio en casa.'],
      },
      {
        tipo: 'simular',
        ejemplo: CASA,
        escenario: { kind: 'loss', events: [{ type: 'destroy-location', location: 'casa', disaster: 'fire' }] },
        texto: 'Simular un incendio en Casa',
      },
      {
        tipo: 'parrafo',
        texto: [
          'La placa de acero de K2 resiste y, con la de K1 del banco, se recupera todo. Pulsa ',
          n('¿Y si no resiste?'),
          ' junto a la placa para ver qué pasaría si también se perdiera.',
        ],
      },
      {
        tipo: 'parrafo',
        texto: [
          'Ya has visto lo esencial. A partir de aquí puedes cambiar cualquier cosa del esquema y ver cómo se mueven las notas, o montar el tuyo desde ',
          n('Archivo → Nuevo esquema'),
          '.',
        ],
      },
    ],
  },
];
