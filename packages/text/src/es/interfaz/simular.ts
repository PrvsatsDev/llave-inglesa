import { comun } from './comun.ts';

const num = comun.numero;

/**
 * Panel de una simulación: sucesos, esfuerzo, privacidad y el porqué. Las frases con una parte en negrita
 * van en trozos (`antes`, `destacado`, `despues`) que el componente une.
 */
export const simular = {
  resultado: {
    stolen: 'Robo posible',
    safe: 'El atacante no llega',
    recoverable: 'Fondos recuperables',
    lockout: 'Bloqueo temporal',
    lost: 'Pérdida permanente',
  },
  verArriba: '(ver arriba)',
  quitarSuceso: 'Quitar suceso',
  anadirSuceso: '+ Añadir otro suceso a la vez…',
  unir: (nombres: readonly string[]) => nombres.join(' y '),
  esfuerzo: 'Esfuerzo del atacante',
  asaltar: (n: number, sitios: string) => `Asaltar ${n} sitios distintos (${sitios})`,
  vencerCoaccion: (dispositivos: string) => `Vencer el PIN de coacción de ${dispositivos}`,
  total: 'Total',
  coaccion: {
    antes: (personas: string, varias: boolean) => `${personas} ${varias ? 'tienen' : 'tiene'} un`,
    destacado: 'PIN de coacción',
    despues: (dispositivos: string, recargo: number) =>
      `en ${dispositivos}: bajo amenaza puede dar ese en lugar del real, y el dispositivo abre una cartera señuelo. El robo solo sale si el atacante sabe que existe y le obliga a dar el bueno; por eso cuesta ${num(recargo)} más. Lo encarece, pero no lo impide.`,
  },
  comprometido: {
    firmware: (fabricante: string | null) =>
      `queda comprometido: un firmware malicioso de ${fabricante ?? 'su fabricante'} filtra en las firmas las semillas que pasan por él. Solo lo evita el anti-exfil.`,
    extraccion: 'queda comprometido: con el dispositivo en la mano, un fallo publicado permite extraer su semilla aunque tenga PIN. Solo la protege una passphrase.',
  },
  privacidad: {
    titulo: 'Privacidad',
    ademas: 'Además, ',
    aunque: 'Aunque no pueda gastar, ',
    antes: 'conoce todas las xpubs: puede calcular tus direcciones y ver',
    destacado: 'tu saldo y todo tu historial',
    despues: 'de transacciones. Saber cuánto tienes también te convierte en un objetivo más atractivo para una llave inglesa.',
    noVe: 'No puede ver tus fondos: le faltan xpubs para calcular tus direcciones.',
  },
  simulacion: 'Simulación',
  salir: 'Salir de la simulación',
  ataques: 'Ataques combinados',
  desgracias: 'Desgracias combinadas',
  porQue: 'Por qué',
  elAtacante: 'El atacante',
  quienQueda: 'Quien queda',
  soloFirma: 'solo consigue firmar con',
  ningunaKey: 'ninguna key',
  hacenFalta: (n: number) => `, y hacen falta ${n}.`,
  trasIncapacidad: ' Cuando las personas incapacitadas fallezcan, los herederos podrán acceder a lo que falta.',
  faltanXpubs: ' Tiene suficientes firmas, pero le faltan xpubs para construir la transacción (el descriptor).',
};
