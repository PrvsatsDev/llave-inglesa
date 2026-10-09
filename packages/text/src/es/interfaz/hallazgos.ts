import { comun } from './comun.ts';

const num = comun.numero;

/** Listas de vías (robos, pérdidas, bloqueos) que se pueden simular, y el arranque de Simular. */
export const hallazgos = {
  aLaVez: (n: number) => (n === 1 ? '1 suceso' : `${n} a la vez`),
  simularEnMapa: 'Simular en el mapa',
  ocultarDemas: 'Ocultar las demás',
  verRestantes: (n: number) => `Ver las ${n} restantes`,
  empezar: 'Empezar con un suceso',
  unAtaque: 'Un ataque',
  eligeAtaque: 'Elige un ataque…',
  unaDesgracia: 'Una desgracia',
  eligeDesgracia: 'Elige una desgracia…',
  robos: {
    titulo: 'Formas más baratas de robar',
    intro: 'Cualquiera de estas combinaciones basta para gastar tus fondos. Pulsa una para verla en el mapa.',
    esfuerzo: (e: number, coaccion: boolean) => `esfuerzo ${num(e)}${coaccion ? ' · vence un PIN de coacción' : ''}`,
    ninguna: (hasta: number) => `Ninguna combinación de hasta ${hasta} ataques lo consigue.`,
    resto: 'Más costosas',
  },
  verEnMapa: 'Ver en el mapa',
  rareza: (r: number, aLaVez: string) => `rareza ${num(r)} · ${aLaVez}`,
  ningunaDesgracia: (hasta: number) => `Ninguna combinación de hasta ${hasta} desgracias lo consigue.`,
  menosProbables: 'Menos probables',
  perdidas: {
    titulo: 'Formas más probables de perderlo todo',
    intro: 'Tras cualquiera de estas, nadie podría recuperar los fondos. Pulsa una para verla en el mapa.',
    yaNo: 'Ya ahora mismo nadie puede recuperar los fondos.',
  },
  bloqueos: {
    titulo: 'Bloqueos temporales',
    intro: 'Los fondos quedarían inmovilizados mientras dure la incapacidad; se recuperan tras el fallecimiento.',
  },
  herencia: {
    titulo: 'Formas más probables de quedarse sin herencia',
    intro: 'Si además del fallecimiento pasa cualquiera de estas, los herederos no podrían recuperar los fondos. Pulsa una para verla en el mapa.',
  },
};
