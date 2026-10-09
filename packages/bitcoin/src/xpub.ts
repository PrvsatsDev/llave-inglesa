import { sha256 } from '@noble/hashes/sha2.js';
import { createBase58check } from '@scure/base';

export const base58check = createBase58check(sha256);

/** mainnet: bc1…, xpub. testnet: tb1…, tpub (también signet, que usa los mismos prefijos). */
export type Network = 'mainnet' | 'testnet';

/** Prefijo de una clave extendida pública (SLIP-132): indica red y, por costumbre, tipo de script. */
type PublicVersion = { network: Network; prefix: string };

const PUBLIC: Record<number, PublicVersion> = {
  0x0488b21e: { network: 'mainnet', prefix: 'xpub' },
  0x049d7cb2: { network: 'mainnet', prefix: 'ypub' },
  0x04b24746: { network: 'mainnet', prefix: 'zpub' },
  0x0295b43f: { network: 'mainnet', prefix: 'Ypub' },
  0x02aa7ed3: { network: 'mainnet', prefix: 'Zpub' },
  0x043587cf: { network: 'testnet', prefix: 'tpub' },
  0x044a5262: { network: 'testnet', prefix: 'upub' },
  0x045f1cf6: { network: 'testnet', prefix: 'vpub' },
  0x024289ef: { network: 'testnet', prefix: 'Upub' },
  0x02575483: { network: 'testnet', prefix: 'Vpub' },
};

/** Las privadas equivalentes: se reconocen solo para rechazarlas. */
const PRIVATE = new Set([
  0x0488ade4, 0x049d7878, 0x04b2430c, 0x0295b005, 0x02aa7a99, 0x04358394, 0x044a4e28, 0x045f18bc, 0x024285b5, 0x02575048,
]);

export const XPUB_VERSION: Record<Network, number> = { mainnet: 0x0488b21e, testnet: 0x043587cf };

export type XpubProblem =
  /** No es base58 o la suma de control no cuadra (una letra mal copiada). */
  | 'invalid'
  /** Es una clave privada (xprv, zprv…): nunca debe entrar en la herramienta. */
  | 'private'
  /** Base58 válido pero no es una clave extendida conocida. */
  | 'unknown-version';

export interface Xpub {
  /** Normalizada a xpub (mainnet) o tpub (testnet), como la esperan los descriptores. */
  xpub: string;
  network: Network;
  /** Prefijo con el que se escribió (zpub, Zpub…), por si interesa avisar de la conversión. */
  writtenAs: string;
  depth: number;
}

export type XpubResult = { ok: true; value: Xpub } | { ok: false; problem: XpubProblem };

const PRIVATE_TEXT = /^[xyzYZtuvUV]prv/;

const readVersion = (b: Uint8Array) => ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;

/** Lee una clave extendida pública en cualquier prefijo SLIP-132 y la normaliza a xpub/tpub. Rechaza las privadas. */
export function parseXpub(text: string): XpubResult {
  const trimmed = text.trim();
  if (PRIVATE_TEXT.test(trimmed)) return { ok: false, problem: 'private' };
  let bytes: Uint8Array;
  try {
    bytes = base58check.decode(trimmed);
  } catch {
    return { ok: false, problem: 'invalid' };
  }
  if (bytes.length !== 78) return { ok: false, problem: 'invalid' };
  const version = readVersion(bytes);
  if (PRIVATE.has(version)) return { ok: false, problem: 'private' };
  const known = PUBLIC[version];
  if (!known) return { ok: false, problem: 'unknown-version' };
  // Una pública lleva un punto comprimido (02/03) donde la privada lleva 00 + la clave.
  if (bytes[45] !== 2 && bytes[45] !== 3) return { ok: false, problem: 'invalid' };
  const normalized = Uint8Array.from(bytes);
  const target = XPUB_VERSION[known.network];
  normalized.set([target >>> 24, (target >>> 16) & 0xff, (target >>> 8) & 0xff, target & 0xff], 0);
  return { ok: true, value: { xpub: base58check.encode(normalized), network: known.network, writtenAs: known.prefix, depth: bytes[4]! } };
}

/** Doce o más palabras en minúscula seguidas (también con tildes, como en la lista española): parece una frase semilla pegada por error. */
export function looksLikeSeedWords(text: string): boolean {
  const words = text.trim().split(/\s+/);
  return words.length >= 12 && words.every((w) => /^\p{Ll}{3,8}$/u.test(w));
}
