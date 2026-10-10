import type { hojaCarta as esCarta, hojaDescriptor as es } from '../../es/interfaz/hojas.ts';

/** Sheets to print: the descriptor and the letter for the heirs. */
export const hojaDescriptor: typeof es = {
  nombre: 'Descriptor to print',
  titulo: 'Wallet descriptor',
  generado: (fecha: string) => `Generated on ${fecha}`,
  introMultisig:
    'The public configuration of the wallet: which keys make it up and how many signatures are needed. In a multisig the seeds alone are not enough to recover it: the xpubs of all the keys are needed, and they are here.',
  introSingle:
    'The public configuration of the wallet. The seed is enough to recover it, but this sheet says which address type and derivation it uses, to find the funds on the first try.',
  noGasta: 'It does not allow spending, but whoever has it sees the balance and every transaction.',
  qr: 'Descriptor QR',
  escanealo: 'Scan it when importing the wallet',
  descriptor: 'Descriptor',
  todoSeguido: (checksum: string) =>
    `All in one go, with no spaces or line breaks. The checksum at the end (#${checksum}) catches any mistake when copying it by hand.`,
  keys: 'Keys',
  columnas: { key: 'Key', fingerprint: 'Fingerprint', derivacion: 'Derivation', xpub: 'Xpub' },
  direcciones: 'First receive addresses',
  compruebaDireccion: 'When restoring the wallet, check that the first one matches: if it does, the descriptor was copied correctly.',
  pie: 'Public data only: no words or private keys. Generated offline with llave-inglesa.',
  nombreBackup: 'Descriptor PDF',
  anadido: (backup: string, lugar: string) => `Added "${backup}" in ${lugar}: the analysis now takes it into account.`,
  otroBackup: 'A printed copy is one more backup. Where are you going to keep it? Add it to the setup so the analysis knows who can see it.',
  anadir: 'Add to the setup',
};

export const hojaCarta: typeof esCarta = {
  nombre: 'Letter for the heirs',
  nombreReal: (de: string) => `Real name of ${de}`,
  nombresReales: 'Real names',
  noSeGuardan: 'Only for this letter: they are not saved. Whatever you leave empty shows the name from the setup.',
  mensaje: 'Personal message',
  pistaMensaje: 'Optional. Not saved either: when you close, it is gone.',
  dondeGuardarla: 'Where to keep it',
  buenSitio: ': the heirs only get in after the death. A good place.',
  laVeraQuienEntre: ': the heirs always have access; whoever gets in will see it.',
  escrita: (fecha: string) => `Written on ${fecha}`,
  antesDeNada: 'First of all',
  queReunir: 'What to gather and where',
  deReserva: ' (spare)',
  deMemoria: 'By heart',
  pasos: 'Steps',
  unasPalabras: 'A few words',
};
