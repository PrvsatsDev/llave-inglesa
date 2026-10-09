/** Las cuatro tarjetas de puntuación de cabeza de la columna. */
export const puntuaciones = {
  abreviaturas: { security: 'Seg', resilience: 'Res', usability: 'Usa', inheritance: 'Her' },
  ubicaciones: ['ubicación', 'ubicaciones'] as const,
  seguridad: {
    sinRobo: (hasta: number) => `ningún robo con ≤${hasta} ataques`,
    roboMasBarato: (esfuerzo: string) => `robo más barato: esfuerzo ${esfuerzo}`,
    vias: (n: number) => `${n} vías`,
  },
  resiliencia: {
    yaNoRecuperable: 'ya ahora no se puede recuperar',
    sinPerdida: (hasta: number) => `ninguna pérdida con ≤${hasta} desgracias`,
    perdidaMasProbable: (rareza: string) => `pérdida más probable: rareza ${rareza}`,
    bloqueo: (rareza: string) => `bloqueo temporal: rareza ${rareza}`,
  },
  usabilidad: {
    firmarEn: (ubicaciones: string) => `firmar en ${ubicaciones}`,
    noPuede: 'no puede firmar de forma segura',
  },
  herencia: {
    herederos: (ubicaciones: string) => `herederos: ${ubicaciones}`,
    sinHerederos: 'no hay herederos',
    noRecuperan: 'los herederos no recuperan',
  },
  pistaTarjeta: (metrica: string, detalle: string) => `${metrica}: ${detalle}. Pulsa para ver por qué`,
  pistaCambio: 'Cambio respecto al último análisis',
  medidor: (metrica: string, valor: number, banda: string) => `${metrica}: ${valor} de 100, ${banda}`,
  pistaMini: (metrica: string, valor: number, banda: string) => `${metrica}: ${valor} de 100, ${banda}. Pulsa para ver por qué`,
  nombre: 'Puntuaciones del esquema',
  desplegar: 'Desplegar el panel',
  analizando: 'Analizando',
  analizandoPuntos: 'Analizando…',
  corrigeErrores: 'Corrige los errores del modelo para analizarlo',
  recalculando: 'recalculando…',
  pausado: 'Modelo con errores: análisis pausado',
  fallido: 'El análisis ha fallado',
  tiempo: (ms: string) => `análisis exhaustivo en ${ms} ms`,
};
