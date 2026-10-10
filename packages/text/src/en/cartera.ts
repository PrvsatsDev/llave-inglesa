import type { DescriptorProblem, ScriptType, XpubProblem } from '@llave-inglesa/bitcoin';
import type { ImportProblem, Match, WalletProblem, WalletWarning } from '@llave-inglesa/domain';
import type * as es from '../es/cartera.ts';
import type { Label } from '../tipos.ts';
import { listText } from './textos.ts';

/** Texts for the wallet descriptor: xpubs, import and what is missing to write it. Same shape as es/cartera.ts. */

const names = (ids: readonly string[], label: Label) => listText(ids.map(label));

export const SCRIPT_TEXT: Record<ScriptType, string> = {
  wsh: 'Native SegWit (bc1q…)',
  'sh-wsh': 'Wrapped SegWit (3…)',
  wpkh: 'Native SegWit (bc1q…)',
  'sh-wpkh': 'Wrapped SegWit (3…)',
};

export const xpubProblemText: typeof es.xpubProblemText = (p: XpubProblem) => {
  switch (p) {
    case 'private':
      return 'That is a private key (xprv, zprv…): it allows spending. Do not write it here or anywhere online; it has not been saved.';
    case 'invalid':
      return 'It is not a valid xpub: something is missing or extra, or a character was copied wrong.';
    case 'unknown-version':
      return 'It is not a known xpub (xpub, ypub, zpub, Ypub, Zpub or their testnet equivalents).';
  }
};

export const WALLET_TEXT: typeof es.WALLET_TEXT = {
  seedWords:
    'That looks like the words of a seed phrase. Never type them here or on any online device: they have been erased without saving anything.',
};

const ORDINALS = ['1st', '2nd', '3rd'];
const ordinal = (i: number) => `the ${ORDINALS[i] ?? `${i + 1}th`} key`;
const capitalized = (t: string) => `${t[0]!.toUpperCase()}${t.slice(1)}`;

export const descriptorProblemText: typeof es.descriptorProblemText = (p: DescriptorProblem) => {
  switch (p.code) {
    case 'empty':
      return 'Paste your wallet’s descriptor.';
    case 'bad-checksum':
      return 'The checksum (what comes after #) does not match: something was copied wrong.';
    case 'unsupported-script':
      return 'That kind of descriptor cannot be read yet: only wsh/sh-wsh multisig with (sorted)multi and wpkh/sh-wpkh single-sig (no Taproot).';
    case 'syntax':
      return 'The descriptor cannot be understood: check that it is complete.';
    case 'bad-key':
      return `${capitalized(ordinal(p.index))} cannot be understood${p.xpub ? `: ${xpubProblemText(p.xpub)}` : '.'}`;
    case 'private-key':
      return 'The descriptor contains a private key: it allows spending. Do not paste it here or anywhere online; nothing has been saved.';
    case 'unsupported-suffix':
      return `${capitalized(ordinal(p.index))} does not end in /<0;1>/*, /0/* or /1/*: that derivation cannot be read.`;
    case 'duplicate-key':
      return `${capitalized(ordinal(p.index))} repeats another one’s xpub.`;
    case 'mixed-networks':
      return 'It mixes mainnet and testnet xpubs.';
    case 'threshold':
      return 'The number of required signatures does not match the number of keys.';
    case 'too-many-keys':
      return 'It has more than 16 keys.';
  }
};

export const importProblemText: typeof es.importProblemText = (p: ImportProblem, label: Label) => {
  switch (p.code) {
    case 'nested-policy':
      return 'This setup’s policy has nested thresholds: it does not have a descriptor yet.';
    case 'shape-mismatch': {
      const shape = (s: { k: number; n: number }) => (s.n === 1 ? 'single-sig' : `${s.k} of ${s.n}`);
      return `The descriptor is ${shape(p.descriptor)} and the setup is ${shape(p.model)}. Adjust the setup’s keys or required signatures and import it again.`;
    }
    case 'fingerprint-not-found':
      return `The fingerprint of ${label(p.key)} does not appear in the descriptor: either the fingerprint is wrong or the descriptor belongs to another wallet. Nothing has been changed.`;
  }
};

const MATCH_TEXT: Record<Match['by'], string> = { xpub: 'by its xpub', fingerprint: 'by its fingerprint', order: 'by order' };

export const matchText: typeof es.matchText = (m: Match, label: Label) => `${label(m.key)}, ${MATCH_TEXT[m.by]}`;

export const walletProblemText: typeof es.walletProblemText = (p: WalletProblem, label: Label) => {
  switch (p.code) {
    case 'nested-policy':
      return 'The policy has nested thresholds: it needs Miniscript, which cannot be written yet.';
    case 'script-mismatch':
      return 'The script type does not fit the policy (single-sig versus multisig).';
    case 'too-many-keys':
      return 'More than 16 keys do not fit in a multisig.';
    case 'missing-xpub':
      return p.keys.length === 1 ? `The xpub of ${names(p.keys, label)} is missing.` : `The xpubs of ${names(p.keys, label)} are missing.`;
    case 'invalid-xpub':
      return `The xpub of ${names(p.keys, label)} is not valid.`;
    case 'duplicate-xpub':
      return `${names(p.keys, label)} have the same xpub: each key needs its own.`;
    case 'mixed-networks':
      return 'Mainnet and testnet xpubs are mixed.';
  }
};

export const walletWarningText: typeof es.walletWarningText = (w: WalletWarning, label: Label) =>
  `${names(w.keys, label)} ${w.keys.length === 1 ? 'is' : 'are'} missing the fingerprint or the derivation: the descriptor is enough to watch the wallet, but the devices need it complete to sign.`;

const SCRIPT_TECH: Record<ScriptType, string> = {
  wsh: 'Native SegWit (P2WSH)',
  'sh-wsh': 'Wrapped SegWit (P2SH-P2WSH)',
  wpkh: 'Native SegWit (P2WPKH)',
  'sh-wpkh': 'Wrapped SegWit (P2SH-P2WPKH)',
};

/** "Multisig 2 of 3 · Native SegWit (P2WSH) · mainnet": the header of the descriptor PDF. */
export const walletKindText: typeof es.walletKindText = (d, network) => {
  const kind = d.threshold === undefined ? 'Single-sig' : `Multisig ${d.threshold} of ${d.keys.length}`;
  return `${kind} · ${SCRIPT_TECH[d.script]} · ${network === 'mainnet' ? 'mainnet' : 'testnet or signet'}`;
};
