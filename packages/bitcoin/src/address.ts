import { ripemd160 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { schnorr } from '@noble/curves/secp256k1.js';
import { bytesToNumberBE } from '@noble/curves/utils.js';
import { bech32, bech32m } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { branchIndex, isMultisigScript, type Descriptor } from './descriptor.ts';
import { miniscriptScript } from './miniscript.ts';
import { base58check, XPUB_VERSION, type Network } from './xpub.ts';

const hash160 = (b: Uint8Array) => ripemd160(sha256(b));
const concat = (...parts: (Uint8Array | number[])[]) => Uint8Array.from(parts.flatMap((p) => [...p]));

const HRP: Record<Network, string> = { mainnet: 'bc', testnet: 'tb' };
const P2SH_VERSION: Record<Network, number> = { mainnet: 0x05, testnet: 0xc4 };
const PRIVATE_VERSION: Record<Network, number> = { mainnet: 0x0488ade4, testnet: 0x04358394 };

const segwitV0 = (program: Uint8Array, network: Network) => bech32.encode(HRP[network], [0, ...bech32.toWords(program)]);
const segwitV1 = (program: Uint8Array, network: Network) => bech32m.encode(HRP[network], [1, ...bech32m.toWords(program)]);

/**
 * Clave de salida Taproot sin árbol de scripts (BIP-86 sobre BIP-341): la clave interna x-only P, ajustada con
 * t = hashTapTweak(P), Q = P + t·G. Es lo que va en la dirección bc1p…
 */
export function taprootOutputKey(publicKey: Uint8Array): Uint8Array {
  const { Point, utils } = schnorr;
  const x = publicKey.length === 33 ? publicKey.slice(1) : publicKey;
  const p = utils.lift_x(bytesToNumberBE(x));
  const t = bytesToNumberBE(utils.taggedHash('TapTweak', x));
  if (t >= Point.Fn.ORDER) throw new Error('Ajuste Taproot fuera del orden de la curva'); // texto-ok: imposible en la práctica (probabilidad ~2⁻¹²⁸)
  return utils.pointToBytes(p.add(Point.BASE.multiply(t)));
}

const p2sh = (redeemScript: Uint8Array, network: Network) => base58check.encode(concat([P2SH_VERSION[network]], hash160(redeemScript)));

/** Clave pública de una xpub en branch/index (derivación no endurecida, la de las direcciones). */
function childKey(xpub: string, network: Network, branch: number, index: number): Uint8Array {
  const node = HDKey.fromExtendedKey(xpub, { public: XPUB_VERSION[network], private: PRIVATE_VERSION[network] });
  return node.deriveChild(branch).deriveChild(index).publicKey!;
}

const compare = (a: Uint8Array, b: Uint8Array) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
};

/** Script multisig: OP_k <claves> OP_n OP_CHECKMULTISIG. Con sortedmulti, claves en orden lexicográfico (BIP-67). */
function multisigScript(k: number, keys: Uint8Array[], sorted: boolean): Uint8Array {
  const ordered = sorted ? [...keys].sort(compare) : keys;
  return concat([0x50 + k], ...ordered.map((key) => concat([key.length], key)), [0x50 + keys.length, 0xae]);
}

/**
 * Dirección número `index` de la rama `branch` (0 recepción, 1 cambio). La primera de recepción (0/0) es la que se
 * compara con la de la cartera para saber que el descriptor está bien.
 */
export function deriveAddress(d: Descriptor, network: Network, branch: 0 | 1 = 0, index = 0): string {
  const keys = d.keys.map((k) => childKey(k.xpub, network, branchIndex(k, branch), index));
  if (d.miniscript) return segwitV0(sha256(miniscriptScript(d.miniscript, (i) => keys[i]!)), network);
  if (isMultisigScript(d.script)) {
    const witnessScript = multisigScript(d.threshold!, keys, d.sorted);
    const program = sha256(witnessScript);
    return d.script === 'wsh' ? segwitV0(program, network) : p2sh(concat([0x00, 0x20], program), network);
  }
  if (d.script === 'tr') return segwitV1(taprootOutputKey(keys[0]!), network);
  const program = hash160(keys[0]!);
  return d.script === 'wpkh' ? segwitV0(program, network) : p2sh(concat([0x00, 0x14], program), network);
}
