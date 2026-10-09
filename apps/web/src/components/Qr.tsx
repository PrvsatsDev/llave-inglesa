/**
 * Un QR dibujado aquí, como un único trazado SVG (sin insertar HTML ni SVG ajeno). Negro sobre blanco y con margen,
 * para que se lea también impreso.
 */
export function Qr({ matrix, size, label }: { matrix: boolean[][]; size: number; label: string }) {
  const n = matrix.length;
  const quiet = 4;
  let d = '';
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < n) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < n && row[x]) x++;
      d += `M${start + quiet} ${y + quiet}h${x - start}v1h${start - x}z`;
    }
  });
  const side = n + 2 * quiet;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${side} ${side}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={side} height={side} fill="var(--paper)" />
      <path d={d} fill="var(--paper-ink)" />
    </svg>
  );
}
