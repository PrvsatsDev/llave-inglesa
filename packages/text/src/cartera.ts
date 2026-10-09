import type { DescriptorProblem, ScriptType, XpubProblem } from '@llave-inglesa/bitcoin';
import type { ImportProblem, Match, WalletProblem, WalletWarning } from '@llave-inglesa/domain';
import type { Label } from './index.ts';

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

/** Frase semilla pegada por error: se borra sin guardar nada. */
export const SEED_WORDS_TEXT =
  'Eso parecen las palabras de una frase semilla. Nunca las escribas aquí ni en ningún dispositivo conectado: se han borrado sin guardar nada.';

const ordinal = (i: number) => `la ${i + 1}.ª key`;

export function descriptorProblemText(p: DescriptorProblem): string {
  switch (p.code) {
    case 'empty':
      return 'Pega el descriptor de tu cartera.';
    case 'bad-checksum':
      return 'La suma de control (lo que va tras #) no cuadra: algo se ha copiado mal.';
    case 'unsupported-script':
      return 'Ese tipo de descriptor todavía no se lee: solo multisig wsh/sh-wsh con (sorted)multi y single-sig wpkh/sh-wpkh (sin Taproot).';
    case 'syntax':
      return 'No se entiende el descriptor: comprueba que está completo.';
    case 'bad-key':
      return `No se entiende ${ordinal(p.index)}${p.xpub ? `: ${xpubProblemText(p.xpub)}` : '.'}`;
    case 'private-key':
      return 'El descriptor lleva una clave privada: permite gastar. No lo pegues aquí ni en ningún sitio conectado; no se ha guardado nada.';
    case 'unsupported-suffix':
      return `${ordinal(p.index)[0]!.toUpperCase()}${ordinal(p.index).slice(1)} no termina en /<0;1>/*, /0/* o /1/*: esa forma de derivar no se lee.`;
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
    case 'nested-policy':
      return 'La política de este esquema tiene umbrales anidados: todavía no tiene descriptor.';
    case 'shape-mismatch': {
      const shape = (s: { k: number; n: number }) => (s.n === 1 ? 'single-sig' : `${s.k} de ${s.n}`);
      return `El descriptor es ${shape(p.descriptor)} y el esquema ${shape(p.model)}. Ajusta las keys o las firmas necesarias del esquema y vuelve a importarlo.`;
    }
    case 'fingerprint-not-found':
      return `El fingerprint de ${label(p.key)} no aparece en el descriptor: o el fingerprint está mal o el descriptor es de otra cartera. No se ha cambiado nada.`;
  }
}

const MATCH_TEXT: Record<Match['by'], string> = { xpub: 'por su xpub', fingerprint: 'por su fingerprint', order: 'por orden' };

export function matchText(m: Match, label: Label): string {
  return `${label(m.key)}, ${MATCH_TEXT[m.by]}`;
}

export function walletProblemText(p: WalletProblem, label: Label): string {
  switch (p.code) {
    case 'nested-policy':
      return 'La política tiene umbrales anidados: necesita Miniscript, que todavía no se escribe.';
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
