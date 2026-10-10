import type { hallazgos as es } from '../../es/interfaz/hallazgos.ts';
import { comun } from './comun.ts';

const num = comun.numero;

/** Lists of routes (thefts, losses, lockouts) that can be simulated, and the start of Simulate. */
export const hallazgos: typeof es = {
  aLaVez: (n: number) => (n === 1 ? '1 event' : `${n} at once`),
  simularEnMapa: 'Simulate on the map',
  ocultarDemas: 'Hide the rest',
  verRestantes: (n: number) => `Show the other ${n}`,
  empezar: 'Start with one event',
  unAtaque: 'An attack',
  eligeAtaque: 'Choose an attack…',
  unaDesgracia: 'A loss event',
  eligeDesgracia: 'Choose a loss event…',
  robos: {
    titulo: 'Cheapest ways to steal',
    intro: 'Any of these combinations is enough to spend your funds. Click one to see it on the map.',
    esfuerzo: (e: number, coaccion: boolean) => `effort ${num(e)}${coaccion ? ' · defeats a duress PIN' : ''}`,
    ninguna: (hasta: number) => `No combination of up to ${hasta} attacks succeeds.`,
    resto: 'More expensive',
  },
  verEnMapa: 'Show on the map',
  rareza: (r: number, aLaVez: string) => `rarity ${num(r)} · ${aLaVez}`,
  ningunaDesgracia: (hasta: number) => `No combination of up to ${hasta} loss events succeeds.`,
  menosProbables: 'Less likely',
  perdidas: {
    titulo: 'Most likely ways to lose everything',
    intro: 'After any of these, nobody could recover the funds. Click one to see it on the map.',
    yaNo: 'Right now nobody can recover the funds.',
  },
  bloqueos: {
    titulo: 'Temporary lockouts',
    intro: 'The funds would be frozen for as long as the incapacity lasts; they are recovered after the death.',
  },
  herencia: {
    titulo: 'Most likely ways to lose the inheritance',
    intro: 'If, on top of the death, any of these happens, the heirs could not recover the funds. Click one to see it on the map.',
  },
};
