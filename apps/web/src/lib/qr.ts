import { encodeQR } from '@paulmillr/qr';

/** Matriz del QR, con la corrección de errores más alta que quepa (un descriptor de 16 keys solo cabe en "low"). Null si no cabe. */
export function qrMatrix(text: string): boolean[][] | null {
  for (const ecc of ['medium', 'low'] as const) {
    try {
      return encodeQR(text, 'raw', { ecc, border: 0 });
    } catch {
      // No cabe con esta corrección: se prueba la siguiente.
    }
  }
  return null;
}
