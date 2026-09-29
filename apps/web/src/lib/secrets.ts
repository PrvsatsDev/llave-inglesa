import type { CustodyModel, SecretRef } from '@llave-inglesa/domain';
import { secretId } from '@llave-inglesa/engine';

/** Todos los secretos que pueden referenciarse en este modelo, en orden de presentación. */
export function secretOptions(model: CustodyModel): SecretRef[] {
  return [
    ...model.keys.flatMap((k): SecretRef[] => [
      { type: 'seed', key: k.id },
      ...(k.passphrase ? [{ type: 'passphrase', key: k.id } as const] : []),
      { type: 'xpub', key: k.id },
    ]),
    { type: 'descriptor' },
    ...model.devices.filter((d) => d.pinProtected).map((d): SecretRef => ({ type: 'pin', device: d.id })),
    ...model.artifacts
      .filter((a) => a.lockedBy.some((l) => l.type === 'password' && l.artifact === a.id))
      .map((a): SecretRef => ({ type: 'password', artifact: a.id })),
  ];
}

export const sameSecret = (a: SecretRef, b: SecretRef) => secretId(a) === secretId(b);

export function toggleSecret(list: SecretRef[], s: SecretRef): SecretRef[] {
  return list.some((x) => sameSecret(x, s)) ? list.filter((x) => !sameSecret(x, s)) : [...list, s];
}
