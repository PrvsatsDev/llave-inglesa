/**
 * Utilidades de animación por fotograma: cada escena es una función pura del número de fotograma,
 * así que el vídeo es determinista (siempre sale igual) y se puede ver en cualquier instante.
 */

export const FPS = 30;
export const ANCHO = 1920;
export const ALTO = 1080;

/** Curvas de suavizado: entran en [0, 1] y salen en [0, 1]. */
export const suave = {
  lineal: (t: number) => t,
  salida: (t: number) => 1 - (1 - t) ** 3,
  entradaSalida: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
};

/** Valor entre `desde` y `hasta` mientras el fotograma va de `inicio` a `fin` (fuera, se queda en los extremos). */
export function interpolar(fotograma: number, inicio: number, fin: number, desde = 0, hasta = 1, curva = suave.salida): number {
  const t = Math.min(1, Math.max(0, (fotograma - inicio) / (fin - inicio)));
  return desde + (hasta - desde) * curva(t);
}
