/** Combinaciones de `k` índices entre `0..n-1`, en orden lexicográfico. */
export function* combinations(n: number, k: number): Generator<number[]> {
  if (k > n || k < 0) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield [...idx];
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i] = idx[i]! + 1;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

/**
 * Conjuntos mínimos de corte (análisis de árbol de fallos): combinaciones de átomos
 * que provocan el resultado, sin que ningún subconjunto ya encontrado lo provoque.
 * Búsqueda exhaustiva por tamaño creciente hasta `maxSize`.
 */
export function minimalCuts<A>(atoms: readonly A[], isCut: (atoms: A[]) => boolean, maxSize: number): A[][] {
  const found: number[][] = [];
  for (let size = 1; size <= maxSize; size++) {
    for (const combo of combinations(atoms.length, size)) {
      if (found.some((cut) => cut.every((i) => combo.includes(i)))) continue;
      if (isCut(combo.map((i) => atoms[i]!))) found.push(combo);
    }
  }
  return found.map((cut) => cut.map((i) => atoms[i]!));
}
