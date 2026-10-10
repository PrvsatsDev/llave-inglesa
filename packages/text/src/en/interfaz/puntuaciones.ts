import type { puntuaciones as es } from '../../es/interfaz/puntuaciones.ts';

/** The four score cards at the top of the column. */
export const puntuaciones: typeof es = {
  abreviaturas: { security: 'Sec', resilience: 'Res', usability: 'Use', inheritance: 'Inh' },
  ubicaciones: ['location', 'locations'],
  seguridad: {
    sinRobo: (hasta: number) => `no theft with ≤${hasta} attacks`,
    roboMasBarato: (esfuerzo: string) => `cheapest theft: effort ${esfuerzo}`,
    vias: (n: number) => `${n} routes`,
  },
  resiliencia: {
    yaNoRecuperable: 'already unrecoverable now',
    sinPerdida: (hasta: number) => `survives ≤${hasta} loss events`,
    perdidaMasProbable: (rareza: string) => `most likely loss: rarity ${rareza}`,
    bloqueo: (rareza: string) => `temporary lockout: rarity ${rareza}`,
  },
  usabilidad: {
    firmarEn: (ubicaciones: string) => `signing at ${ubicaciones}`,
    noPuede: 'cannot sign safely',
  },
  herencia: {
    herederos: (ubicaciones: string) => `heirs: ${ubicaciones}`,
    sinHerederos: 'no heirs',
    noRecuperan: 'the heirs cannot recover',
  },
  pistaTarjeta: (metrica: string, detalle: string) => `${metrica}: ${detalle}. Click to see why`,
  pistaCambio: 'Change since the last analysis',
  medidor: (metrica: string, valor: number, banda: string) => `${metrica}: ${valor} out of 100, ${banda}`,
  pistaMini: (metrica: string, valor: number, banda: string) => `${metrica}: ${valor} out of 100, ${banda}. Click to see why`,
  nombre: 'Setup scores',
  desplegar: 'Expand the panel',
  analizando: 'Analyzing',
  analizandoPuntos: 'Analyzing…',
  corrigeErrores: 'Fix the errors in the model to analyze it',
  recalculando: 'recalculating…',
  pausado: 'Model with errors: analysis paused',
  fallido: 'The analysis failed',
  tiempo: (ms: string) => `exhaustive analysis in ${ms} ms`,
};
