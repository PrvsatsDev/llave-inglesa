import type { ficheros as es } from '../../es/interfaz/ficheros.ts';

/** Saving, opening, importing and exporting: the dialogs that come with each action. */
export const ficheros: typeof es = {
  nombrePorDefecto: 'setup',
  sufijoRescate: 'rescue',
  descartar: {
    titulo: 'Unsaved changes',
    mensaje: 'If you continue, the changes you have not saved will be lost.',
    confirmar: 'Discard changes',
  },
  invalido: {
    titulo: 'The document is not valid',
    intro: 'It could not be opened because it has errors:',
    raiz: 'document',
  },
  contrasenaIncorrecta: 'Wrong password.',
  sustituir: {
    titulo: 'Replace the saved setup',
    mensaje: 'There is already a setup saved in this browser. If you continue, it will be replaced by the one you have open.',
    confirmar: 'Replace',
  },
  guardar: {
    titulo: 'Save in this browser',
    mensajeSustituye: 'There is already a setup saved in this browser and it will be replaced. Choose the password to encrypt it with.',
    mensaje: 'The setup will be saved encrypted in this browser. Nobody can read it without this password.',
  },
  noGuardado: {
    titulo: 'Could not save',
    lineas: ['This browser does not allow saving data (private mode or blocked storage).', 'Use "Export encrypted" to save it as a file.'],
  },
  sinCifrado: {
    titulo: 'Encryption needs HTTPS',
    lineas: [
      'Browsers only allow encryption over a secure connection, and this page is open over http://.',
      'Open it over https:// (on Umbrel, with the same address and port) to save or open encrypted setups. Everything else works the same.',
    ],
  },
  abrirLocal: {
    titulo: 'Open your setup',
    mensaje: 'There is an encrypted setup saved in this browser. Enter its password.',
  },
  borrarLocal: {
    titulo: 'Delete what is saved in this browser',
    mensaje: 'The encrypted setup saved here will be deleted. This cannot be undone. Export a copy first if you want to keep it.',
    confirmar: 'Delete',
  },
  exportarCifrado: {
    titulo: 'Export encrypted',
    mensaje: 'An encrypted .llave file will be downloaded. Opening it will require this password (it can be different from the browser one).',
  },
  exportarPlano: {
    titulo: 'Export unencrypted',
    mensaje:
      'The JSON file is not encrypted: anyone who reads it will know where your backups are, who knows what and how to attack you. Use it only to work with it and delete it afterwards.',
    confirmar: 'Export anyway',
  },
  noSePuedeAbrir: {
    titulo: 'Cannot open',
    noJson: 'The file is not JSON.',
    noEsquema: 'The file is not a llave-inglesa setup.',
  },
  abrirCifrado: {
    titulo: (fichero: string) => `Open ${fichero}`,
    mensaje: 'This file is encrypted. Enter its password.',
  },
};
