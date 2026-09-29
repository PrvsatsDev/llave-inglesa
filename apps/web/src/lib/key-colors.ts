import type { CustodyModel, Id } from '@llave-inglesa/domain';

const PALETTE_SIZE = 6;

/** Color estable de una key según su posición en el modelo (tokens --key-1…6). */
export function keyColor(model: CustodyModel, key: Id): string {
  const index = model.keys.findIndex((k) => k.id === key);
  return index < 0 ? 'var(--text-faint)' : `var(--key-${(index % PALETTE_SIZE) + 1})`;
}
