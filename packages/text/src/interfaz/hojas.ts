/** Hojas para imprimir: el descriptor y la carta para los herederos (sus frases largas viven en carta-herencia.ts). */
export const hojaDescriptor = {
  nombre: 'Descriptor para imprimir',
  titulo: 'Descriptor de la cartera',
  generado: (fecha: string) => `Generado el ${fecha}`,
  introMultisig:
    'La configuración pública de la cartera: qué keys la forman y cuántas firmas hacen falta. En un multisig las semillas solas no bastan para recuperarla: hacen falta las xpubs de todas las keys, y están aquí.',
  introSingle:
    'La configuración pública de la cartera. Con la semilla basta para recuperarla, pero este papel dice qué tipo de dirección y qué derivación usa, para encontrar los fondos a la primera.',
  noGasta: 'No permite gastar, pero quien lo tenga ve el saldo y todos los movimientos.',
  qr: 'QR del descriptor',
  escanealo: 'Escanéalo al importar la cartera',
  descriptor: 'Descriptor',
  todoSeguido: (checksum: string) =>
    `Todo seguido, sin espacios ni saltos de línea. La suma de control del final (#${checksum}) detecta cualquier error al copiarlo a mano.`,
  keys: 'Keys',
  columnas: { key: 'Key', fingerprint: 'Fingerprint', derivacion: 'Derivación', xpub: 'Xpub' },
  direcciones: 'Primeras direcciones de recepción',
  compruebaDireccion: 'Al restaurar la cartera, comprueba que la primera coincide: si es así, el descriptor está bien copiado.',
  pie: 'Solo datos públicos: ni palabras ni claves privadas. Generado sin conexión con llave-inglesa.',
  /** Nombre del backup que se añade al esquema; distinto del «Descriptor impreso» que se crea a mano. */
  nombreBackup: 'PDF con descriptor',
  anadido: (backup: string, lugar: string) => `Añadido «${backup}» en ${lugar}: el análisis ya lo tiene en cuenta.`,
  otroBackup: 'Una copia impresa es un backup más. ¿Dónde la vas a guardar? Añádela al esquema para que el análisis sepa quién puede verla.',
  anadir: 'Añadir al esquema',
};

export const hojaCarta = {
  nombre: 'Carta para los herederos',
  nombreReal: (de: string) => `Nombre real de ${de}`,
  nombresReales: 'Nombres reales',
  noSeGuardan: 'Solo para esta carta: no se guardan. Lo que dejes vacío sale con el nombre del esquema.',
  mensaje: 'Mensaje personal',
  pistaMensaje: 'Opcional. Tampoco se guarda: al cerrar, desaparece.',
  dondeGuardarla: 'Dónde guardarla',
  buenSitio: ': los herederos solo entran tras el fallecimiento. Buen sitio.',
  laVeraQuienEntre: ': los herederos entran siempre; la verá quien entre.',
  escrita: (fecha: string) => `Escrita el ${fecha}`,
  antesDeNada: 'Antes de nada',
  queReunir: 'Qué reunir y dónde',
  deReserva: ' (de reserva)',
  deMemoria: 'De memoria',
  pasos: 'Pasos',
  unasPalabras: 'Unas palabras',
};
