import { parseModel, type CustodyModel, type ParseResult } from '@llave-inglesa/domain';
import { isEnvelope, seal, unseal, type Envelope, type VaultKey } from './crypto.ts';

/** Lo que hay dentro de un fichero abierto por el usuario. */
export type ReadResult =
  | { kind: 'plain'; result: ParseResult }
  | { kind: 'encrypted'; envelope: Envelope }
  | { kind: 'invalid'; reason: 'not-json' | 'unknown-format' };

export function serializeModel(model: CustodyModel): string {
  return JSON.stringify(model, null, 2);
}

/** Detecta si el texto es un modelo en claro, un documento cifrado o ninguno de los dos. */
export function readDocument(text: string): ReadResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: 'invalid', reason: 'not-json' };
  }
  if (isEnvelope(json)) return { kind: 'encrypted', envelope: json };
  if (typeof json === 'object' && json !== null && (json as { format?: unknown }).format === 'llave-inglesa') {
    return { kind: 'plain', result: parseModel(json) };
  }
  return { kind: 'invalid', reason: 'unknown-format' };
}

export async function sealModel(model: CustodyModel, vault: VaultKey): Promise<Envelope> {
  return seal(serializeModel(model), vault);
}

/** Descifra y valida. Lanza WrongPasswordError si la contraseña no es la buena. */
export async function unsealModel(envelope: Envelope, password: string): Promise<{ result: ParseResult; vault: VaultKey }> {
  const { plaintext, vault } = await unseal(envelope, password);
  return { result: parseModel(JSON.parse(plaintext)), vault };
}
