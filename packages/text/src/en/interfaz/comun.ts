import type { comun as es } from '../../es/interfaz/comun.ts';

/** Words repeated across the whole interface. */
export const comun: typeof es = {
  cancelar: 'Cancel',
  cerrar: 'Close',
  entendido: 'Got it',
  copiar: 'Copy',
  copiada: 'Copied',
  sinNombre: 'Unnamed',
  anadir: 'Add',
  numero: (n: number) => n.toLocaleString('en'),
  fecha: (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
  imprimir: 'Print or save as PDF',
};
