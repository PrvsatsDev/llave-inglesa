import { encodeQR } from 'qr';

/** Matriz del QR, con la corrección de errores más alta que quepa (un descriptor de 16 keys solo cabe en "low"). Null si no cabe. */
export function qrMatrix(text: string): boolean[][] | null {
  for (const ecc of ['medium', 'low'] as const) {
    try {
      // La librería exige algo de margen: se pide el mínimo y se quita (el margen lo dibuja el componente).
      return encodeQR(text, 'raw', { ecc, border: 1 })
        .slice(1, -1)
        .map((row) => row.slice(1, -1));
    } catch {
      // No cabe con esta corrección: se prueba la siguiente.
    }
  }
  return null;
}
