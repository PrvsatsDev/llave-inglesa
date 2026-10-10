import type { AttackAtom, LossEvent } from '@llave-inglesa/engine';

/** Tipos y utilidades comunes a todos los idiomas. */

export type Label = (id: string) => string;

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------- Guía de uso ----------

export type Metrica = 'security' | 'resilience' | 'usability' | 'inheritance';

/**
 * Un trozo de texto: texto normal, en negrita, la puntuación de un ejemplo en una métrica, un enlace
 * externo (se abre aparte) o un enlace a otro capítulo de la guía.
 */
export type Trozo =
  | string
  | { negrita: string }
  | { cifra: { ejemplo: string; metrica: Metrica } }
  | { enlace: string; texto: string }
  | { capitulo: string; texto: string };

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
