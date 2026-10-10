/**
 * Textos de llave-inglesa, en el idioma activo (ver idioma.ts). Las funciones puras son compartidas por la web y la
 * CLI: el motor nunca produce texto. Cada export es «vivo» (vivo.ts): responde al idioma activo aunque se haya
 * importado o guardado en una constante antes de cambiarlo.
 */

import { TEXTOS, idioma, type Textos } from './idioma.ts';
import { vivo } from './vivo.ts';

const T: Textos = vivo(() => TEXTOS[idioma()]);

export const {
  ADVISORY_KIND,
  ADVISORY_TITLE,
  ATTACK_KIND_TEXT,
  LETTER_TEXT,
  PASSPHRASE_STRENGTH_TEXT,
  ROLE_TEXT,
  SCORE_BAND_TEXT,
  SCRIPT_TEXT,
  WALLET_TEXT,
  advisoryShortName,
  advisoryText,
  attackText,
  descriptorProblemText,
  duressText,
  factText,
  importProblemText,
  inheritanceText,
  issueText,
  letterGreeting,
  letterHelpers,
  letterMemoryText,
  letterPieceText,
  letterSteps,
  letterWhatThereIs,
  letterWhen,
  listText,
  lossText,
  matchText,
  mitigationText,
  originText,
  policyText,
  provenanceText,
  ruleText,
  secretText,
  walletKindText,
  walletProblemText,
  vendorText,
  walletWarningText,
  xpubProblemText,
  GUIA,
  guiaMarkdown,
  UI,
} = T;

export { detectarIdioma, idioma, IDIOMAS, NOMBRE_IDIOMA, setIdioma, type Idioma, type Textos } from './idioma.ts';
export { CIFRAS } from './guia-cifras.ts';
export * from './tipos.ts';
export type TextosInterfaz = Textos['UI'];
