import type { archivo as esArchivo, cabecera as es } from '../../es/interfaz/cabecera.ts';

/** Header: open document, save status, history and the File menu. */
export const cabecera: typeof es = {
  acercaDe: 'About llave-inglesa',
  documentoAbierto: 'Open document or example',
  origen: { ejemplo: 'example', nuevo: 'new', local: 'saved in this browser' },
  gruposEjemplos: { inicio: 'Getting started', single: 'Gallery: single-sig', multi: 'Gallery: 2-of-3 multisig' },
  sinGuardar: 'Unsaved',
  guardado: 'Saved',
  pistaGuardar: 'Save with Ctrl+S (encrypted, in this browser)',
  politica: 'Policy',
  deshacer: 'Undo',
  pistaDeshacer: 'Undo (Ctrl+Z)',
  rehacer: 'Redo',
  pistaRehacer: 'Redo (Ctrl+Shift+Z)',
  idioma: 'Language',
  local: '100% local',
  pistaLocal: 'The app cannot make network requests',
  localAccesible: '100% local: the app cannot make network requests',
  descripcionPagina: 'Simulate your Bitcoin custody: which theft leaves you without funds, which loss event makes you lose them, can your heirs reach them?',
};

export const archivo: typeof esArchivo = {
  menu: 'File',
  nuevo: 'New setup',
  abrir: 'Open file…',
  pistaAbrir: '.llave or .json',
  abrirLocal: 'Open the one saved in this browser',
  guardarLocal: 'Save in this browser',
  pistaGuardarLocal: 'encrypted',
  exportarCifrado: 'Export encrypted…',
  exportarPlano: 'Export unencrypted…',
  borrarLocal: 'Delete the one saved in this browser',
  guia: 'User guide',
  acercaDe: 'About llave-inglesa',
  pie: 'Everything happens on your computer: nothing is sent to any server.',
};
