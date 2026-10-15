import type { DescriptorProblem, ScriptType, XpubProblem } from '@llave-inglesa/bitcoin';
import {
  mapPolicyKeys,
  policyKeys,
  policyShape,
  shapeKeys,
  type ImportProblem,
  type Match,
  type MiniscriptReason,
  type Policy,
  type PolicyShape,
  type WalletProblem,
  type WalletWarning,
} from '@llave-inglesa/domain';
import type { Label } from '../tipos.ts';
import { policyText, waitText } from './textos.ts';

/** Textos del descriptor de la cartera: xpubs, importación y lo que falta para escribirlo. */

const names = (ids: readonly string[], label: Label) => {
  const all = ids.map(label);
  return all.length <= 1 ? (all[0] ?? '') : `${all.slice(0, -1).join(', ')} y ${all.at(-1)}`;
};

export const SCRIPT_TEXT: Record<ScriptType, string> = {
  wsh: 'SegWit nativo (bc1q…)',
  'sh-wsh': 'SegWit envuelto (3…)',
  wpkh: 'SegWit nativo (bc1q…)',
  'sh-wpkh': 'SegWit envuelto (3…)',
};

export function xpubProblemText(p: XpubProblem): string {
  switch (p) {
    case 'private':
      return 'Eso es una clave privada (xprv, zprv…): permite gastar. No la escribas aquí ni en ningún sitio conectado; no se ha guardado.';
    case 'invalid':
      return 'No es una xpub válida: falta o sobra algo, o hay una letra mal copiada.';
    case 'unknown-version':
      return 'No es una xpub conocida (xpub, ypub, zpub, Ypub, Zpub o sus equivalentes de testnet).';
  }
}

export const WALLET_TEXT = {
  /** Frase semilla pegada por error: se borra sin guardar nada. */
  seedWords:
    'Eso parecen las palabras de una frase semilla. Nunca las escribas aquí ni en ningún dispositivo conectado: se han borrado sin guardar nada.',
};

const ordinal = (i: number) => `la ${i + 1}.ª key`;

export function descriptorProblemText(p: DescriptorProblem): string {
  switch (p.code) {
    case 'empty':
      return 'Pega el descriptor de tu cartera.';
    case 'bad-checksum':
      return 'La suma de control (lo que va tras #) no cuadra: algo se ha copiado mal.';
    case 'unsupported-script':
      return 'Ese tipo de descriptor todavía no se lee: solo multisig wsh/sh-wsh con (sorted)multi, single-sig wpkh/sh-wpkh y Miniscript en wsh (sin Taproot ni sh(wsh(miniscript))).';
    case 'miniscript-unsafe':
      return 'Ese Miniscript no es válido o no es seguro, y Bitcoin Core no lo aceptaría: los tipos no encajan, alguna forma de gastar no pide firma, la firma se puede alterar o mezcla timelocks de altura y de tiempo.';
    case 'syntax':
      return 'No se entiende el descriptor: comprueba que está completo.';
    case 'bad-key':
      return `No se entiende ${ordinal(p.index)}${p.xpub ? `: ${xpubProblemText(p.xpub)}` : '.'}`;
    case 'private-key':
      return 'El descriptor lleva una clave privada: permite gastar. No lo pegues aquí ni en ningún sitio conectado; no se ha guardado nada.';
    case 'unsupported-suffix':
      return `${ordinal(p.index)[0]!.toUpperCase()}${ordinal(p.index).slice(1)} no termina en /<0;1>/*, /0/* o /1/* (en Miniscript, también /<2;3>/*, /<4;5>/*…): esa forma de derivar no se lee.`;
    case 'duplicate-key':
      return `${ordinal(p.index)[0]!.toUpperCase()}${ordinal(p.index).slice(1)} repite la xpub de otra.`;
    case 'mixed-networks':
      return 'Mezcla xpubs de mainnet y de testnet.';
    case 'threshold':
      return 'El número de firmas necesarias no cuadra con el número de keys.';
    case 'too-many-keys':
      return 'Tiene más de 16 keys.';
  }
}

export function importProblemText(p: ImportProblem, label: Label): string {
  switch (p.code) {
    case 'descriptor-policy':
      return 'El descriptor usa algo que aquí no se modela, como timelocks absolutos (after), esperas por tiempo o hashes. No se ha cambiado nada.';
    case 'policy-mismatch': {
      // Cada xpub distinta, por orden: #1, #2… (una que se repite con <2;3> es la misma).
      const order = [...policyKeys(p.descriptor)].sort((x, y) => x - y);
      const descriptor = mapPolicyKeys(p.descriptor, (i) => `#${order.indexOf(i) + 1}`);
      return `El descriptor es ${describePolicy(descriptor, (k) => k)} y el esquema ${describePolicy(p.model, label)}. Puedes usar la política del descriptor o ajustar la del esquema.`;
    }
    case 'fingerprint-not-found':
      return `El fingerprint de ${label(p.key)} no aparece en el descriptor: o el fingerprint está mal o el descriptor es de otra cartera. No se ha cambiado nada.`;
  }
}

/** Una política en una frase, para comparar la del descriptor con la del esquema: por su plantilla, si es una. */
function describePolicy(p: Policy, label: Label): string {
  const shape = policyShape(p);
  return shape ? shapeText(shape) : policyText(p, label);
}

function shapeText(s: PolicyShape): string {
  const kOfN = `${s.k} de ${s.keys.length}`;
  switch (s.kind) {
    case 'plain':
      return s.keys.length === 1 ? 'single-sig' : kOfN;
    case 'inheritance':
      return `una herencia simple (${kOfN}, o la de recuperación sola tras ${waitText(s.blocks)})`;
    case 'decaying':
      return `un multisig decreciente (${kOfN}, ${s.k - 1} tras ${waitText(s.blocks)})`;
    case 'expanding':
      return `un multisig ampliable (${s.k} de ${s.keys.length}, ${s.k} de ${shapeKeys(s).length} tras ${waitText(s.blocks)})`;
  }
}

const MATCH_TEXT: Record<Match['by'], string> = { xpub: 'por su xpub', fingerprint: 'por su fingerprint', order: 'por orden' };

export function matchText(m: Match, label: Label): string {
  return `${label(m.key)}, ${MATCH_TEXT[m.by]}`;
}

/** Por qué una política no se escribe en Miniscript (tras «no se puede escribir…: »). */
export const MINISCRIPT_REASON: Record<MiniscriptReason, string> = {
  unsigned: 'alguna forma de gastar no pide ninguna firma',
  'script-size': 'el script pasaría de 3600 bytes, el máximo que la red acepta',
  ops: 'alguna forma de gastar ejecutaría más de 201 operaciones, el máximo de Bitcoin',
  stack: 'alguna forma de gastar necesitaría más de 100 elementos en el witness, el máximo que la red acepta',
  other: 'Bitcoin Core no lo aceptaría (la firma se podría alterar o mezcla timelocks)',
};

export function walletProblemText(p: WalletProblem, label: Label): string {
  switch (p.code) {
    case 'no-miniscript':
      return `Esta política no se puede escribir en Miniscript de forma segura: ${MINISCRIPT_REASON[p.reason]}.`;
    case 'script-mismatch':
      return 'El tipo de script no encaja con la política (single-sig frente a multisig).';
    case 'too-many-keys':
      return 'Más de 16 keys no caben en un multisig.';
    case 'missing-xpub':
      return p.keys.length === 1 ? `Falta la xpub de ${names(p.keys, label)}.` : `Faltan las xpubs de ${names(p.keys, label)}.`;
    case 'invalid-xpub':
      return `La xpub de ${names(p.keys, label)} no es válida.`;
    case 'duplicate-xpub':
      return `${names(p.keys, label)} tienen la misma xpub: cada key necesita la suya.`;
    case 'mixed-networks':
      return 'Hay xpubs de mainnet y de testnet mezcladas.';
  }
}

export function walletWarningText(w: WalletWarning, label: Label): string {
  return `A ${names(w.keys, label)} ${w.keys.length === 1 ? 'le' : 'les'} falta el fingerprint o la derivación: el descriptor sirve para vigilar la cartera, pero los dispositivos lo necesitan completo para firmar.`;
}

const SCRIPT_TECH: Record<ScriptType, string> = {
  wsh: 'SegWit nativo (P2WSH)',
  'sh-wsh': 'SegWit envuelto (P2SH-P2WSH)',
  wpkh: 'SegWit nativo (P2WPKH)',
  'sh-wpkh': 'SegWit envuelto (P2SH-P2WPKH)',
};

/** "Multisig 2 de 3 · SegWit nativo (P2WSH) · mainnet" (o "Miniscript con 4 keys · …"): la cabecera del PDF del descriptor. */
export function walletKindText(d: { script: ScriptType; threshold?: number; keys: readonly unknown[]; miniscript?: unknown }, network: 'mainnet' | 'testnet'): string {
  const kind = d.miniscript ? `Miniscript con ${d.keys.length} keys` : d.threshold === undefined ? 'Single-sig' : `Multisig ${d.threshold} de ${d.keys.length}`;
  return `${kind} · ${SCRIPT_TECH[d.script]} · ${network === 'mainnet' ? 'mainnet' : 'testnet o signet'}`;
}
