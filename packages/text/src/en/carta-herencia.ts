import type { CustodyModel, SecretRef } from '@llave-inglesa/domain';
import { flatPolicy, walletOf } from '@llave-inglesa/domain';
import type { InheritanceLetter, LetterPiece } from '@llave-inglesa/engine';
import type * as es from '../es/carta-herencia.ts';
import type { Label } from '../tipos.ts';
import { listText } from './textos.ts';

/**
 * Texts of the letter for the heirs. Meant for someone who knows nothing about Bitcoin: short sentences, no jargon,
 * and never a secret (only where it is). `label` already brings any real names typed in on the fly.
 * Same shape as es/carta-herencia.ts.
 */

export const letterGreeting: typeof es.letterGreeting = (letter: InheritanceLetter, label: Label) => `To ${listText(letter.heirs.map(label))}`;

export const letterWhen: typeof es.letterWhen = (letter: InheritanceLetter, label: Label) =>
  `This letter is to be read after the death of ${listText(letter.owners.map(label))}. It explains how to recover their bitcoin.`;

/** What there is, without jargon: how many keys are needed. */
export const letterWhatThereIs: typeof es.letterWhatThereIs = (model: CustodyModel) => {
  const flat = flatPolicy(model);
  if (flat?.kind === 'single') {
    return 'The bitcoin is protected by a single key. Whoever has what is listed below can move it, so treat it like cash.';
  }
  if (flat?.kind === 'multi') {
    return `The bitcoin is in a wallet that needs ${flat.k} of its ${flat.keys.length} keys to move it (this is called “multisig”). You do not need to gather them all: what is listed below is enough.`;
  }
  return 'The bitcoin is in a wallet that needs a combination of several keys to move it. What is listed below is enough.';
};

export const letterHelpers: typeof es.letterHelpers = (letter: InheritanceLetter, label: Label) =>
  letter.helpers.length === 0
    ? null
    : `You will need the help of ${listText(letter.helpers.map(label))}: they have access to something that is needed.`;

const secretText = (s: SecretRef, label: Label): string => {
  switch (s.type) {
    case 'seed':
      return `the seed phrase of ${label(s.key)}`;
    case 'passphrase':
      return `the passphrase of ${label(s.key)} (an extra word or phrase that goes with its seed phrase)`;
    case 'xpub':
      return `the xpub of ${label(s.key)}`;
    case 'pin':
      return `the PIN of ${label(s.device)}`;
    case 'password':
      return `the password of ${label(s.artifact)}`;
    case 'descriptor':
      return 'the wallet descriptor (the public list of its keys, without which it cannot be rebuilt)';
  }
};

/** What a piece is for: “the seed phrase of K1”, “signs with K1; unlocked with its PIN”. */
export const letterPieceText: typeof es.letterPieceText = (p: LetterPiece, label: Label) => {
  const parts = p.provides.map((s) => secretText(s, label));
  if (p.signs.length > 0) parts.push(`signs with ${listText(p.signs.map(label))}${p.needsPin ? '; unlocked with its PIN' : ''}`);
  if (p.hasWallet) parts.push('has the wallet registered');
  return parts.length > 0 ? parts.join('; ') : 'needed';
};

export const letterMemoryText: typeof es.letterMemoryText = (m, label) => `${label(m.person)} knows ${secretText(m.secret, label)} by heart.`;

const SCRIPT_PLAIN = {
  wsh: 'Native SegWit (P2WSH, addresses bc1q…)',
  'sh-wsh': 'Wrapped SegWit (P2SH-P2WSH, addresses 3…)',
  wpkh: 'Native SegWit (P2WPKH, addresses bc1q…)',
  'sh-wpkh': 'Wrapped SegWit (P2SH-P2WPKH, addresses 3…)',
} as const;

/** Public data to rebuild a multisig without a descriptor: type, k of n and derivation (if known). */
function rebuildData(model: CustodyModel): string {
  const flat = flatPolicy(model);
  const shape = flat?.kind === 'multi' ? `multisig ${flat.k} of ${flat.keys.length}` : 'multisig';
  const paths = [...new Set(model.keys.map((k) => k.derivation).filter((d): d is string => d !== undefined))];
  const path = paths.length === 1 ? `, derivation m/${paths[0]}` : '';
  return `${shape}, ${SCRIPT_PLAIN[walletOf(model).script]}${path}`;
}

/** The steps, generic: they do not depend on a specific wallet. */
export const letterSteps: typeof es.letterSteps = (model: CustodyModel, letter: InheritanceLetter) => {
  const multisig = flatPolicy(model)?.kind !== 'single';
  const withDescriptor = letter.usesDescriptor || letter.stops.some((s) => s.pieces.some((p) => p.needed && p.hasWallet));
  const steps = [
    'When you decide to recover it, gather the pieces on the list and keep them together in a safe place for as long as the process lasts.',
    'If you know nothing about Bitcoin, you have time: you can learn what you need at your own pace, or ask someone you trust who knows about it to go through it with you. They should help by your side, without taking anything or asking you for the words.',
  ];
  if (multisig && withDescriptor) {
    steps.push(
      'On a computer, install a wallet that supports multisig (for example Sparrow or Nunchuk) and import the descriptor: by scanning its QR code or copying it.',
      'Check that the first receive address it shows matches the one on the printed descriptor, if you have it. If it matches, it is the right wallet.',
      'Seed phrases are not typed into the computer: they are loaded onto a signing device (a “hardware wallet”) and you sign with it.',
    );
  } else if (multisig) {
    steps.push(
      `There is no copy of the descriptor: the wallet is rebuilt from the seed phrases of all its keys, which is why all of them are needed. This is the hardest part; here it really is worth having someone who knows help you. The data to rebuild it: ${rebuildData(model)}.`,
      'Each seed phrase is loaded onto a signing device (a “hardware wallet”), never onto the computer; with them, a wallet that supports multisig (for example Sparrow or Nunchuk) puts the wallet together.',
    );
  } else {
    steps.push(
      'Load the seed phrase onto a signing device (a “hardware wallet”), never onto a computer or a phone, and connect it to its app to see the balance.',
    );
  }
  if (letter.memory.some((m) => m.secret.type === 'passphrase') || letter.stops.some((s) => s.pieces.some((p) => p.provides.some((x) => x.type === 'passphrase')))) {
    steps.push('With the passphrase, type it exactly the same (capital letters, spaces, accents): a single different character opens another, empty wallet.');
  }
  steps.push('Before moving everything, send a small amount and check that it arrives.');
  return steps;
};

/** Fixed sentences of the letter and of the panel that prepares it. */
export const LETTER_TEXT: typeof es.LETTER_TEXT = {
  calm: [
    'There is no hurry. Bitcoin does not expire: it can wait months or years without anything happening. The only thing worth doing soon is checking that you can reach the pieces on the list, without moving them from where they are.',
    'Do not tell anyone who does not need to know, and do not mention it on social media.',
    'Nobody legitimate will ask you for the words of a seed phrase: not a bank, not a lawyer, not “tech support”. Whoever asks for them wants to steal them.',
    'Never type those words into a website, a phone or a computer, and never take photos of them.',
    'Be wary of anyone who offers to “manage” it for you or to recover it for a fee.',
  ],
  spareNote:
    'What is marked “spare” is not needed, but it is good to know it exists in case you cannot reach one of the other pieces.',
  noDescriptor:
    'The heirs cannot reach any copy of the descriptor: they will have to rebuild the wallet with the seed phrases of all the keys, which is harder and forces them to gather them all. Keep the “Descriptor PDF” (Setup › Wallet descriptor) with the letter and add it to the setup.',
  footer: 'This letter does not contain any key or password: it only says what to look for and where. Keep it in a safe place.',
  printAdvice:
    'Print it on a printer of your own, connected by cable or offline, and never at a print shop, at work or on a shared printer: the letter is a map of where your keys are.',
};
