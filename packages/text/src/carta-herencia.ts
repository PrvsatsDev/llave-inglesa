import type { CustodyModel, SecretRef } from '@llave-inglesa/domain';
import { flatPolicy, walletOf } from '@llave-inglesa/domain';
import type { InheritanceLetter, LetterPiece } from '@llave-inglesa/engine';
import { listText, type Label } from './index.ts';

/**
 * Textos de la carta para los herederos. Pensada para alguien que no sabe de Bitcoin: frases cortas, sin jerga, y
 * nunca un secreto (solo dónde está). `label` ya trae los nombres reales que se hayan puesto al vuelo.
 */

export const letterGreeting = (letter: InheritanceLetter, label: Label) => `Para ${listText(letter.heirs.map(label))}`;

export const letterWhen = (letter: InheritanceLetter, label: Label) =>
  `Esta carta es para leerla tras el fallecimiento de ${listText(letter.owners.map(label))}. Explica cómo recuperar sus bitcoins.`;

/** Qué hay, sin jerga: cuántas llaves hacen falta. */
export function letterWhatThereIs(model: CustodyModel): string {
  const flat = flatPolicy(model);
  if (flat?.kind === 'single') {
    return 'Los bitcoins están protegidos por una sola llave. Quien tenga lo que se lista abajo puede moverlos, así que trátalo como dinero en efectivo.';
  }
  if (flat?.kind === 'multi') {
    return `Los bitcoins están en una cartera que necesita ${flat.k} de sus ${flat.keys.length} llaves para moverlos (es lo que se llama «multisig»). No hace falta reunirlas todas: con lo que se lista abajo basta.`;
  }
  return 'Los bitcoins están en una cartera que necesita una combinación de varias llaves para moverlos. Con lo que se lista abajo basta.';
}

/** Lo primero: reglas que protegen al heredero de prisas, engaños y descuidos. */
export const LETTER_CALM: readonly string[] = [
  'No hay prisa. Los bitcoins no caducan: pueden esperar meses o años sin que pase nada. Lo único que conviene hacer pronto es comprobar que llegas a las piezas de la lista, sin sacarlas de su sitio.',
  'No se lo cuentes a nadie que no lo necesite saber, ni lo comentes en redes.',
  'Nadie legítimo te pedirá las palabras de una frase semilla: ni un banco, ni un abogado, ni un «soporte técnico». Quien las pida, quiere robarlas.',
  'Nunca escribas esas palabras en una web, en un móvil ni en un ordenador, ni les hagas fotos.',
  'Desconfía de quien se ofrezca a «gestionarlos» por ti o a recuperarlos a cambio de una comisión.',
];

export const letterHelpers = (letter: InheritanceLetter, label: Label) =>
  letter.helpers.length === 0
    ? null
    : `Necesitarás la ayuda de ${listText(letter.helpers.map(label))}: ${letter.helpers.length === 1 ? 'tiene' : 'tienen'} acceso a algo que hace falta.`;

const secretText = (s: SecretRef, label: Label): string => {
  switch (s.type) {
    case 'seed':
      return `la frase semilla de ${label(s.key)}`;
    case 'passphrase':
      return `la passphrase de ${label(s.key)} (una palabra o frase extra que acompaña a su frase semilla)`;
    case 'xpub':
      return `la xpub de ${label(s.key)}`;
    case 'pin':
      return `el PIN de ${label(s.device)}`;
    case 'password':
      return `la contraseña de ${label(s.artifact)}`;
    case 'descriptor':
      return 'el descriptor de la cartera (la lista pública de sus llaves, sin la que no se puede reconstruir)';
  }
};

/** Para qué sirve una pieza: «la frase semilla de K1», «firma con K1; necesita su PIN». */
export function letterPieceText(p: LetterPiece, label: Label): string {
  const parts = p.provides.map((s) => secretText(s, label));
  if (p.signs.length > 0) parts.push(`firma con ${listText(p.signs.map(label))}${p.needsPin ? '; se desbloquea con su PIN' : ''}`);
  if (p.hasWallet) parts.push('tiene registrada la cartera');
  return parts.length > 0 ? parts.join('; ') : 'hace falta';
}

export const letterMemoryText = (m: { person: string; secret: SecretRef }, label: Label) =>
  `${label(m.person)} sabe de memoria ${secretText(m.secret, label)}.`;

/** Aviso bajo «Qué reunir y dónde» cuando hay backups de reserva. */
export const LETTER_SPARE_NOTE =
  'Lo marcado «de reserva» no hace falta, pero es bueno que sepas que existe por si no llegas a alguna de las otras piezas.';

const SCRIPT_PLAIN = {
  wsh: 'SegWit nativo (P2WSH, direcciones bc1q…)',
  'sh-wsh': 'SegWit envuelto (P2SH-P2WSH, direcciones 3…)',
  wpkh: 'SegWit nativo (P2WPKH, direcciones bc1q…)',
  'sh-wpkh': 'SegWit envuelto (P2SH-P2WPKH, direcciones 3…)',
} as const;

/** Datos públicos para reconstruir un multisig sin descriptor: tipo, k de n y derivación (si se conoce). */
function rebuildData(model: CustodyModel): string {
  const flat = flatPolicy(model);
  const shape = flat?.kind === 'multi' ? `multisig ${flat.k} de ${flat.keys.length}` : 'multisig';
  const paths = [...new Set(model.keys.map((k) => k.derivation).filter((d): d is string => d !== undefined))];
  const path = paths.length === 1 ? `, derivación m/${paths[0]}` : '';
  return `${shape}, ${SCRIPT_PLAIN[walletOf(model).script]}${path}`;
}

/** Los pasos, genéricos: no dependen de una cartera concreta. */
export function letterSteps(model: CustodyModel, letter: InheritanceLetter): string[] {
  const multisig = flatPolicy(model)?.kind !== 'single';
  const withDescriptor = letter.usesDescriptor || letter.stops.some((s) => s.pieces.some((p) => p.needed && p.hasWallet));
  const steps = [
    'Cuando decidas recuperarlos, reúne las piezas de la lista y guárdalas juntas en un sitio seguro mientras dure el proceso.',
    'Si no sabes de Bitcoin, tienes tiempo: puedes aprender lo necesario a tu ritmo, o pedir a alguien de confianza que sepa que te acompañe. Que te ayude a tu lado, sin llevarse nada ni pedirte las palabras.',
  ];
  if (multisig && withDescriptor) {
    steps.push(
      'En un ordenador, instala una cartera que admita multisig (por ejemplo Sparrow o Nunchuk) e importa el descriptor: escaneando su QR o copiándolo.',
      'Comprueba que la primera dirección de recepción que muestra coincide con la del descriptor impreso, si la tienes. Si coincide, la cartera es la buena.',
      'Las frases semilla no se escriben en el ordenador: se cargan en un dispositivo de firma (una «hardware wallet») y se firma con él.',
    );
  } else if (multisig) {
    steps.push(
      `No hay copia del descriptor: la cartera se reconstruye a partir de las frases semilla de todas sus llaves, por eso hacen falta todas. Es la parte más difícil; aquí sí conviene que te ayude alguien que sepa. Los datos para reconstruirla: ${rebuildData(model)}.`,
      'Cada frase semilla se carga en un dispositivo de firma (una «hardware wallet»), nunca en el ordenador; con ellos, una cartera que admita multisig (por ejemplo Sparrow o Nunchuk) monta la cartera.',
    );
  } else {
    steps.push(
      'Carga la frase semilla en un dispositivo de firma (una «hardware wallet»), nunca en un ordenador o un móvil, y conéctalo a su aplicación para ver el saldo.',
    );
  }
  if (letter.memory.some((m) => m.secret.type === 'passphrase') || letter.stops.some((s) => s.pieces.some((p) => p.provides.some((x) => x.type === 'passphrase')))) {
    steps.push('Con la passphrase, escríbela exactamente igual (mayúsculas, espacios, tildes): un solo carácter distinto abre otra cartera vacía.');
  }
  steps.push('Antes de mover todo, envía una cantidad pequeña y comprueba que llega.');
  return steps;
}

/** Aviso al preparar la carta (en pantalla): multisig sin copia del descriptor al alcance de los herederos. */
export const LETTER_NO_DESCRIPTOR =
  'Los herederos no llegan a ninguna copia del descriptor: tendrán que reconstruir la cartera con las frases semilla de todas las llaves, lo que es más difícil y obliga a reunirlas todas. Guarda junto a la carta el «PDF con descriptor» (Esquema › Descriptor de la cartera) y añádelo al esquema.';

export const LETTER_FOOTER = 'Esta carta no contiene ninguna llave ni contraseña: solo dice qué buscar y dónde. Guárdala en un lugar seguro.';

/** Consejos al imprimir (en pantalla, no en la carta). */
export const LETTER_PRINT_ADVICE =
  'Imprímela en una impresora tuya conectada por cable o sin red, y nunca en una copistería, el trabajo o una impresora compartida: la carta es un mapa de dónde están tus llaves.';
