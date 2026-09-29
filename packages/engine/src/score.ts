/**
 * Puntuaciones 0–100. Deliberadamente simples y explicables: cada una sale
 * de UNA métrica objetiva que se muestra junto al número.
 */

/** Seguridad y resiliencia: cuántas cosas tienen que salir mal a la vez. */
export function cutScore(minSize: number | null): number {
  if (minSize === null) return 100; // ningún corte dentro del límite buscado
  return [0, 25, 60, 85][minSize] ?? 100;
}

/** Usabilidad: cuántas ubicaciones hay que visitar para firmar de forma segura. */
export function usabilityScore(locations: number | null): number {
  if (locations === null) return 0;
  return [100, 100, 75, 50][locations] ?? 30;
}

/** Herencia: si los herederos pueden recuperar los fondos, y cuánto les cuesta. */
export function inheritanceScore(locations: number | null): number {
  if (locations === null) return 0;
  return [100, 100, 90, 80][locations] ?? 65;
}
