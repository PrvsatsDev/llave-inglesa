import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calcular, huella, serializar } from './calcular.ts';
import { CARPETA, aleatorios, ejemplos } from './documentos.ts';

/**
 * Lo existente no cambia (docs/PLAN-KEYS-REPARTIDAS.md, 2.1): cada documento da, byte a byte, lo mismo que antes
 * de la rama. Si esto falla, no se regenera: se para y se discute. Para ver qué cambió en un modelo aleatorio,
 * se recalcula con el código del commit de la fase 0 y se compara.
 */
const leer = (f: string): unknown => JSON.parse(readFileSync(new URL(f, CARPETA), 'utf8'));
const deEjemplos = leer('esperado-ejemplos.json') as Record<string, unknown>;
const deAleatorios = leer('esperado-aleatorios.json') as string[];

describe('resultados congelados', () => {
  it('están todos los ejemplos', () => {
    expect(Object.keys(deEjemplos)).toEqual(ejemplos().map(([ruta]) => ruta));
  });

  it.each(ejemplos())('%s', (ruta, doc) => {
    const ahora = serializar(calcular(doc));
    // Primero la estructura (si falla, se ve la diferencia); después, byte a byte (orden incluido).
    expect(JSON.parse(ahora)).toEqual(deEjemplos[ruta]);
    expect(ahora).toBe(JSON.stringify(deEjemplos[ruta]));
  });

  it('los 300 modelos aleatorios', () => {
    const docs = aleatorios();
    expect(docs).toHaveLength(300);
    expect(deAleatorios).toHaveLength(300);
    const distintos = docs.flatMap((doc, i) => (huella(serializar(calcular(doc))) === deAleatorios[i] ? [] : [i]));
    expect(distintos).toEqual([]);
  });
});
