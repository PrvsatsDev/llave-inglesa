/** Palabras sueltas que se repiten en toda la interfaz. */
export const comun = {
  cancelar: 'Cancelar',
  cerrar: 'Cerrar',
  entendido: 'Entendido',
  copiar: 'Copiar',
  copiada: 'Copiada',
  sinNombre: 'Sin nombre',
  anadir: 'Añadir',
  /** Números con el formato del idioma (separador de miles). */
  numero: (n: number) => n.toLocaleString('es'),
  /** Fecha larga, para los documentos impresos: «9 de octubre de 2026». */
  fecha: (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
  imprimir: 'Imprimir o guardar como PDF',
};
