import type { marco as es } from '../../es/interfaz/marco.ts';

/** The app frame: panel, map, legend, mobile tabs and crash screen. */
export const marco: typeof es = {
  panel: 'Panel',
  anchoPanel: 'Panel width',
  pistaAncho: 'Drag to change the width (double-click: default width)',
  avisoMovil: 'Designed for a large screen. Here you can browse the examples and simulate, but a computer is better for building your setup.',
  mapa: 'Custody map',
  pestanas: {
    nombre: 'Panel or map',
    panel: 'Panel',
    mapa: 'Map',
    nuevo: 'new',
    pistaNuevo: 'The map has changed since you last looked at it',
  },
  leyenda: {
    titulo: 'Legend',
    key: 'the key itself (seed phrase or memorized)',
    passphrase: 'passphrase',
    xpub: 'xpub only',
    pin: 'PIN-protected',
    memoria: 'knows it by heart',
    siempre: 'always has access',
    trasFallecer: 'has access after a death',
  },
  fallo: {
    titulo: 'Something went wrong in the interface',
    noEsTuEsquema: 'It is a bug in the app, not in your setup.',
    conCambios: 'You have unsaved changes: download them before reloading.',
    sinCambios: 'Your setup has no unsaved changes.',
    descargar: 'Download the setup (.json)',
    recargar: 'Reload',
    nota: 'The file is not encrypted: keep it somewhere safe, open it with "Open file…" and delete it afterwards.',
    detalle: 'Technical details',
  },
  falloAnalisis: 'The analysis worker failed',
};
