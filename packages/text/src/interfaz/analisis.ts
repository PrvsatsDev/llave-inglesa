import {
  ATTACK_EFFORT,
  BURGLARY_EFFORT,
  CLOUD_BREACH_EFFORT,
  COERCION_SURCHARGE,
  DURESS_SURCHARGE,
  EXPOSURE,
  EXTRA_SITE_SURCHARGE,
  HEIR_FRAGILITY_WEIGHT,
  inheritanceScore,
  LOCKOUT_PENALTY,
  LOSS_RARITY,
  NO_DESCRIPTOR_PENALTY,
  PASSPHRASE_EFFORT,
  rarityScore,
  securityBreakdown,
  usabilityScore,
} from '@llave-inglesa/engine';
// Import circular con index.ts (que reexporta UI): es seguro mientras solo se usen dentro de funciones.
import { ATTACK_KIND_TEXT, plural } from '../index.ts';
import { comun } from './comun.ts';

const num = comun.numero;
const UBICACIONES = ['ubicación', 'ubicaciones'] as const;

/** "1 ubicación → 100 · 2 ubicaciones → 85 · … · 4 o más → …" */
const scale = (f: (n: number) => number, unit: readonly [string, string], from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)
    .map((n) => `${n === to ? `${n} o más` : plural(n, ...unit)} → ${f(n)}`)
    .join(' · ');

/** Sección Análisis › métrica: puntuación con su desglose, cómo se calcula y lo que la explica. */
export const analisis = {
  corrigeErrores: 'Corrige los errores del esquema para ver el análisis.',
  analizando: 'Analizando…',
  coaccion: 'PIN de coacción',
  puntuacion: 'Puntuación',
  minimo: 'Mínimo mientras robar cueste algo',
  total: 'Total',
  comoSeCalcula: 'Cómo se calcula',

  seguridad: {
    sinRobo: (hasta: number) => `Ningún robo con hasta ${hasta} ataques a la vez`,
    roboMasBarato: (esfuerzo: number) => `Robo más barato: esfuerzo ${num(esfuerzo)}`,
    viasBaratas: (vias: number, hasta: number) => `${vias} vías casi igual de baratas (esfuerzo ≤ ${num(hasta)})`,
    como: (hasta: number) => {
      const efforts = (Object.entries(ATTACK_EFFORT) as [keyof typeof ATTACK_EFFORT, number][])
        .sort((x, y) => x[1] - y[1])
        .map(([type, e]) => `${ATTACK_KIND_TEXT[type]} ${num(e)}`)
        .join(' · ');
      const curve = [1, 1.5, 2, 3, 4, 5, 6].map((e) => `${num(e)}${e === 6 ? ' o más' : ''} → ${securityBreakdown(e, 1).base}`).join(' · ');
      return [
        `Se buscan todas las combinaciones de hasta ${hasta} ataques que permiten gastar. Cada ataque suma su esfuerzo: ${efforts}. Hackear una cuenta en la nube cuesta ${num(CLOUD_BREACH_EFFORT)}. Entrar en una caja fuerte cuesta ${num(BURGLARY_EFFORT['home-safe'])} y en una caja del banco ${num(BURGLARY_EFFORT['bank-box'])}; si está dentro de otra ubicación, hay que entrar en ambas y solo suma la diferencia. Cada sitio físico distinto que haya que asaltar, después del primero, +${num(EXTRA_SITE_SURCHARGE)} (una ubicación dentro de otra es el mismo sitio). La llave inglesa en una caja del banco, +${num(COERCION_SURCHARGE['bank-box'])}. Adivinar una passphrase teniendo la semilla: débil ${num(PASSPHRASE_EFFORT.weak)} · frase ${num(PASSPHRASE_EFFORT.phrase)} · aleatoria larga, imposible. Si hay que vencer un PIN de coacción, +${num(DURESS_SURCHARGE)}.`,
        `Cuanto más esfuerzo exige el robo más barato, más puntuación: ${curve}.`,
        `Tener varias vías casi igual de baratas (hasta ${num(EXPOSURE.margin)} más de esfuerzo) resta ${EXPOSURE.penaltyPerExtraRoute} por cada vía extra, como mucho ${EXPOSURE.maxPenalty}.`,
      ];
    },
  },

  resiliencia: {
    nadiePuede: 'Ahora mismo nadie puede recuperar los fondos',
    otrasVias: (n: number, rareza: number) => `${plural(n, 'vía más', 'vías más')}: todas juntas equivalen a rareza ${num(rareza)}`,
    sinDescriptor: 'Sin ninguna copia del descriptor: si fallan los dispositivos, habría que reconstruir la cartera',
    bloqueo: (rareza: number) => `Bloqueo temporal más probable: rareza ${num(rareza)}`,
    sinPerdida: (hasta: number) => `Ninguna combinación de hasta ${hasta} desgracias lo pierde todo`,
    perdidaMasProbable: (rareza: number) => `Pérdida más probable: rareza ${num(rareza)}`,
    como: (hasta: number) => {
      const r = LOSS_RARITY;
      return [
        `Cada desgracia tiene una rareza: cuántos órdenes de magnitud tiene de improbable. Olvidar lo memorizado ${num(r.forget)} · perder o romper un objeto ${num(r['item-loss'])} (una placa o arandelas de acero, que solo se pueden extraviar, ${num(r['steel-loss'])}) · avería de un portátil o pérdida de una cuenta ${num(r.total.device)} · incendio, inundación o fallecimiento ${num(r.fire)} (incendio o inundación en una caja del banco ${num(r['vault-disaster'])}) · incapacidad ${num(r.incapacity)} · pérdida del acceso a un sitio ${num(r.total.physical)}.`,
        `Varias desgracias a la vez suman sus rarezas (como multiplicar probabilidades). Se buscan las combinaciones de hasta ${hasta} tras las que nadie podría recuperar los fondos nunca; cuanto más rara la más probable, más puntuación: ${[1, 2, 3, 4, 5, 6].map((x) => `${x}${x === 6 ? ' o más' : ''} → ${rarityScore(x)}`).join(' · ')}.`,
        'Las demás vías también cuentan: sus probabilidades se suman, y la puntuación sale de la rareza equivalente de todas juntas.',
        `Un bloqueo temporal (fondos inmovilizados mientras alguien está incapacitado) no pierde nada, pero resta: ${LOCKOUT_PENALTY.map((p) => `rareza menor que ${num(p.below)} −${p.points}`).join(' · ')}.`,
        `Un multisig sin ninguna copia del descriptor resta ${NO_DESCRIPTOR_PENALTY.resilience}: con las semillas salen las xpubs, pero no cómo se combinan (tipo de script, k de n, derivación), y reconstruir la cartera así es difícil o, con derivaciones poco habituales, casi imposible.`,
      ];
    },
  },

  usabilidad: {
    noPueden: 'Los titulares no pueden firmar de forma segura',
    firmarExige: (n: number) => `Firmar exige ir a ${plural(n, ...UBICACIONES)}`,
    como: () => [
      'Cuántas ubicaciones tienen que visitar los titulares para firmar de forma segura: con dispositivos de firma, sin teclear ninguna frase semilla en un ordenador.',
      `${scale(usabilityScore, UBICACIONES, 1, 4)}.`,
    ],
    dondeSeFirma: 'Dónde se firma',
    minimoVisitar: 'Lo mínimo que tienen que visitar los titulares para firmar una transacción:',
    quienes: 'Con todo lo que tienen a su alcance, los titulares',
  },

  herencia: {
    recuperan: (conHerederos: boolean, n: number) => `${conHerederos ? 'Los herederos recuperan' : 'Se recupera'} yendo a ${plural(n, ...UBICACIONES)}`,
    sinHerederos: 'No hay herederos',
    noRecuperan: 'Los herederos no pueden recuperar los fondos',
    sinDescriptor: 'Sin descriptor: los herederos tendrían que reconstruir la cartera con las semillas',
    fragilidad: (formas: number, rareza: number, juntas: number | null) =>
      `Fragilidad: ${plural(formas, 'forma', 'formas')} de quedarse sin los fondos; la más probable, rareza ${num(rareza)}${juntas !== null ? `, todas juntas ${num(juntas)}` : ''}`,
    como: () => [
      'Tras el fallecimiento de todos los titulares, si los herederos pueden recuperar los fondos con lo que tienen a su alcance (incluidos los accesos "tras fallecer"), y cuántas ubicaciones les cuesta.',
      `${scale(inheritanceScore, UBICACIONES, 1, 4)}.`,
      `Después se resta la fragilidad de ese camino. El fallecimiento es seguro, así que se da por hecho y se buscan las desgracias que, además, dejarían a los herederos sin los fondos (perder la única copia, un incendio, que fallezca el heredero…). Su robustez se puntúa como la resiliencia, y se resta ${num(HEIR_FRAGILITY_WEIGHT)} × lo que le falta para 100: como mucho ${num(Math.round(HEIR_FRAGILITY_WEIGHT * 100))}.`,
      `En un multisig, si los herederos no llegan a ninguna copia del descriptor (ni a un dispositivo con la cartera registrada que puedan desbloquear), se resta ${NO_DESCRIPTOR_PENALTY.inheritance}: tendrían que reconstruir la cartera con las semillas sin saber el tipo de script ni la derivación. Si hay una vía con descriptor, se elige esa aunque cueste un viaje más.`,
    ],
    titulo: 'Herederos',
    nadieMas:
      'Nadie más que los titulares puede llegar a los fondos. Para modelar la herencia, marca a una persona como heredera en su ficha (Esquema › Personas) y dale acceso a alguna ubicación, por ejemplo "tras fallecer" el titular.',
    trasFallecer: 'Tras el fallecimiento de los titulares,',
    yendoA: ', yendo a:',
    simular: 'Simular el fallecimiento en el mapa',
    losHerederos: 'Los herederos',
    quienesQuedan: 'Con todo lo que tienen a su alcance, quienes quedan',
  },

  porQue: 'Por qué',
  /** «{quién} solo consiguen firmar con {keys}, y hacen falta {n}.» El componente pone las keys en negrita. */
  soloFirman: { antes: (quien: string) => `${quien} solo consiguen firmar con`, despues: (n: number) => `, y hacen falta ${n}.` },
  ningunaKey: 'ninguna key',
  faltanXpubs: ' Tienen firmas suficientes, pero les faltan xpubs para construir la transacción (el descriptor).',

  carta: {
    titulo: 'Carta para los herederos',
    sinDescriptor:
      'Los herederos no recuperan los fondos porque no llegan a ninguna copia del descriptor. Guarda una donde puedan llegar (por ejemplo el «PDF con descriptor», desde Esquema › Descriptor de la cartera) y la carta estará disponible.',
    explicacion:
      'Una carta para imprimir con lo que necesitan los herederos: qué reunir y dónde (solo lo que usan), a quién acudir y los pasos, en palabras sencillas. Nunca lleva secretos. Los nombres reales y un mensaje personal se escriben al vuelo y no se guardan.',
    preparar: 'Preparar la carta',
  },
};
