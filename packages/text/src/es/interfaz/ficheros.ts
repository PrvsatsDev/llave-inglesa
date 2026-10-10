/** Guardar, abrir, importar y exportar: los diálogos que acompañan a cada acción. */
export const ficheros = {
  /** Nombre del fichero cuando el esquema no tiene nombre aprovechable. */
  nombrePorDefecto: 'esquema',
  sufijoRescate: 'rescate',
  descartar: {
    titulo: 'Cambios sin guardar',
    mensaje: 'Si continúas, se perderán los cambios que no has guardado.',
    confirmar: 'Descartar cambios',
  },
  invalido: {
    titulo: 'El documento no es válido',
    intro: 'No se ha podido abrir porque tiene errores:',
    raiz: 'documento',
  },
  contrasenaIncorrecta: 'Contraseña incorrecta.',
  sustituir: {
    titulo: 'Sustituir el esquema guardado',
    mensaje: 'En este navegador ya hay un esquema guardado. Si continúas, se sustituirá por el que tienes abierto.',
    confirmar: 'Sustituir',
  },
  guardar: {
    titulo: 'Guardar en este navegador',
    mensajeSustituye: 'Ya hay un esquema guardado en este navegador y se sustituirá. Elige la contraseña con la que se cifrará.',
    mensaje: 'El esquema se guardará cifrado en este navegador. Nadie podrá leerlo sin esta contraseña.',
  },
  noGuardado: {
    titulo: 'No se ha podido guardar',
    lineas: ['Este navegador no permite guardar datos (modo privado o almacenamiento bloqueado).', 'Usa "Exportar cifrado" para guardarlo como fichero.'],
  },
  abrirLocal: {
    titulo: 'Abrir tu esquema',
    mensaje: 'Hay un esquema guardado y cifrado en este navegador. Introduce su contraseña.',
  },
  borrarLocal: {
    titulo: 'Borrar el guardado de este navegador',
    mensaje: 'Se eliminará el esquema cifrado guardado aquí. No se puede deshacer. Exporta antes una copia si la quieres conservar.',
    confirmar: 'Borrar',
  },
  exportarCifrado: {
    titulo: 'Exportar cifrado',
    mensaje: 'Se descargará un fichero .llave cifrado. Para abrirlo hará falta esta contraseña (puede ser distinta de la del navegador).',
  },
  exportarPlano: {
    titulo: 'Exportar sin cifrar',
    mensaje:
      'El fichero JSON no va cifrado: cualquiera que lo lea sabrá dónde están tus backups, quién sabe qué y cómo atacarte. Úsalo solo para trabajar con él y bórralo después.',
    confirmar: 'Exportar de todos modos',
  },
  noSePuedeAbrir: {
    titulo: 'No se puede abrir',
    noJson: 'El fichero no es JSON.',
    noEsquema: 'El fichero no es un esquema de llave-inglesa.',
  },
  abrirCifrado: {
    titulo: (fichero: string) => `Abrir ${fichero}`,
    mensaje: 'Este fichero está cifrado. Introduce su contraseña.',
  },
};
