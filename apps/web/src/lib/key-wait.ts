import type { CustodyModel, Id } from '@llave-inglesa/domain';
import { keyWait } from '@llave-inglesa/engine';

/** Bloques que hay que esperar para que la key sirva, si solo sirve tras un timelock (si no, undefined). */
export function keyWaitBlocks(model: CustodyModel, key: Id): number | undefined {
  const wait = keyWait(model.policy, key);
  return wait ? wait : undefined;
}
