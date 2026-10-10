import { idioma } from '../lib/text.ts';

/**
 * Las frases propias del vídeo, en cada idioma. El resto (mapa, ataques, desgracias, avisos, notas) sale de
 * packages/text, como en la app. El vídeo queda fuera del guardián de textos: es una pieza aparte.
 */
const VIDEO = {
  es: {
    papelEnCasa: 'Tu frase semilla, en un papel en casa.',
    bastaConEntrar: 'Basta con que alguien entre.',
    oUnIncendio: 'O con un incendio.',
    reparte: 'Reparte. Combina. Prueba.',
    siFaltas: '¿Y si faltas tú?',
    familia: 'Tu familia sabría llegar.',
    comoRobarte: 'Cómo podrían robarte',
    quePerder: 'Qué te lo haría perder',
    herederos: 'Si tus herederos llegarían',
    esfuerzo: (n: string) => `esfuerzo ${n}`,
    rareza: (n: string) => `rareza ${n}`,
    salvo: (s: string) => `Salvo: ${s}`,
    porque: 'Y siempre te dice por qué.',
    lema: 'Pon a prueba la custodia de tus bitcoins antes de que lo haga otro.',
    promesa: 'Sin red · sin cuentas · código abierto',
  },
  en: {
    papelEnCasa: 'Your seed phrase, on paper at home.',
    bastaConEntrar: 'All it takes is someone getting in.',
    oUnIncendio: 'Or a fire.',
    reparte: 'Spread. Combine. Test.',
    siFaltas: 'What if you are gone?',
    familia: 'Your family would get there.',
    comoRobarte: 'How you could be robbed',
    quePerder: 'What would make you lose it',
    herederos: 'Would your heirs get there',
    esfuerzo: (n: string) => `effort ${n}`,
    rareza: (n: string) => `rarity ${n}`,
    salvo: (s: string) => `Unless: ${s}`,
    porque: 'And it always tells you why.',
    lema: 'Test your bitcoin custody before someone else does.',
    promesa: 'No network · no accounts · open source',
  },
};

export const T = VIDEO[idioma()];
