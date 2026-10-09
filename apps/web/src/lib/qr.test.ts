import { formatDescriptor, type Descriptor } from '@llave-inglesa/bitcoin';
import decodeQR from '@paulmillr/qr/decode.js';
import { HDKey } from '@scure/bip32';
import { describe, expect, it } from 'vitest';
import { qrMatrix } from './qr.ts';

/** Pinta la matriz como imagen RGB (4 px por módulo, con margen) y la lee con el decodificador. */
function read(matrix: boolean[][]): string {
  const scale = 4;
  const quiet = 4;
  const side = (matrix.length + 2 * quiet) * scale;
  const data = new Uint8Array(side * side * 3).fill(255);
  matrix.forEach((row, y) =>
    row.forEach((on, x) => {
      if (!on) return;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) data.fill(0, (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 3, (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 3 + 3);
    }),
  );
  return decodeQR({ width: side, height: side, data });
}

const descriptor = (n: number): string => {
  const keys = Array.from({ length: n }, (_, s) => {
    const node = HDKey.fromMasterSeed(Uint8Array.from({ length: 32 }, (_, i) => (i === 0 ? s + 1 : i)));
    return { fingerprint: node.fingerprint.toString(16).padStart(8, '0'), path: "48'/0'/0'/2'", xpub: node.derive("m/48'/0'/0'/2'").publicExtendedKey };
  });
  const d: Descriptor = { script: 'wsh', threshold: Math.ceil(n / 2), sorted: true, keys };
  return formatDescriptor(d);
};

describe('QR del descriptor', () => {
  it('un 2 de 3 se codifica y se vuelve a leer igual', () => {
    const text = descriptor(3);
    const matrix = qrMatrix(text)!;
    expect(read(matrix)).toBe(text);
  });

  it('el mayor multisig que se escribe (16 keys) aún cabe en un QR', () => {
    const text = descriptor(16);
    expect(text.length).toBeGreaterThan(2000);
    expect(qrMatrix(text)).not.toBeNull();
  });

  it('si no cabe, no hay QR (y la hoja muestra solo el texto)', () => {
    expect(qrMatrix('x'.repeat(4000))).toBeNull();
  });
});
