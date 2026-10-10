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
import type { analisis as es } from '../../es/interfaz/analisis.ts';
import { plural } from '../../tipos.ts';
import { ATTACK_KIND_TEXT } from '../textos.ts';
import { comun } from './comun.ts';

const num = comun.numero;
const UBICACIONES: [string, string] = ['location', 'locations'];

/** "1 location → 100 · 2 locations → 85 · … · 4 or more → …" */
const scale = (f: (n: number) => number, unit: readonly [string, string], from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)
    .map((n) => `${n === to ? `${n} or more` : plural(n, ...unit)} → ${f(n)}`)
    .join(' · ');

/** Analysis › metric: the score with its breakdown, how it is calculated and what explains it. */
export const analisis: typeof es = {
  corrigeErrores: 'Fix the errors in the setup to see the analysis.',
  analizando: 'Analyzing…',
  coaccion: 'Duress PIN',
  puntuacion: 'Score',
  minimo: 'Minimum while stealing costs something',
  total: 'Total',
  comoSeCalcula: 'How it is calculated',

  seguridad: {
    sinRobo: (hasta: number) => `No theft with up to ${hasta} attacks at once`,
    roboMasBarato: (esfuerzo: number) => `Cheapest theft: effort ${num(esfuerzo)}`,
    viasBaratas: (vias: number, hasta: number) => `${vias} almost equally cheap routes (effort ≤ ${num(hasta)})`,
    como: (hasta: number) => {
      const efforts = (Object.entries(ATTACK_EFFORT) as [keyof typeof ATTACK_EFFORT, number][])
        .sort((x, y) => x[1] - y[1])
        .map(([type, e]) => `${ATTACK_KIND_TEXT[type]} ${num(e)}`)
        .join(' · ');
      const curve = [1, 1.5, 2, 3, 4, 5, 6].map((e) => `${num(e)}${e === 6 ? ' or more' : ''} → ${securityBreakdown(e, 1).base}`).join(' · ');
      return [
        `Every combination of up to ${hasta} attacks that allows spending is searched for. Each attack adds its effort: ${efforts}. Hacking a cloud account costs ${num(CLOUD_BREACH_EFFORT)}. Breaking into a home safe costs ${num(BURGLARY_EFFORT['home-safe'])} and into a bank safe deposit box ${num(BURGLARY_EFFORT['bank-box'])}; if it is inside another location, both have to be broken into and only the difference is added. Each additional physical place that has to be raided, after the first, +${num(EXTRA_SITE_SURCHARGE)} (a location inside another is the same place). A wrench attack at a bank box, +${num(COERCION_SURCHARGE['bank-box'])}. Guessing a passphrase once you have the seed: weak ${num(PASSPHRASE_EFFORT.weak)} · phrase ${num(PASSPHRASE_EFFORT.phrase)} · long random, impossible. If a duress PIN has to be defeated, +${num(DURESS_SURCHARGE)}.`,
        `The more effort the cheapest theft requires, the higher the score: ${curve}.`,
        `Having several almost equally cheap routes (up to ${num(EXPOSURE.margin)} more effort) subtracts ${EXPOSURE.penaltyPerExtraRoute} for each extra route, at most ${EXPOSURE.maxPenalty}.`,
      ];
    },
  },

  resiliencia: {
    nadiePuede: 'Right now nobody can recover the funds',
    otrasVias: (n: number, rareza: number) => `${plural(n, 'more route', 'more routes')}: all together they amount to rarity ${num(rareza)}`,
    sinDescriptor: 'No copy of the descriptor at all: if the devices fail, the wallet would have to be rebuilt',
    bloqueo: (rareza: number) => `Most likely temporary lockout: rarity ${num(rareza)}`,
    sinPerdida: (hasta: number) => `Survives any combination of up to ${hasta} loss events`,
    perdidaMasProbable: (rareza: number) => `Most likely loss: rarity ${num(rareza)}`,
    como: (hasta: number) => {
      const r = LOSS_RARITY;
      return [
        `Each loss event has a rarity: how many orders of magnitude unlikely it is. Forgetting what was memorized ${num(r.forget)} · losing or breaking an item ${num(r['item-loss'])} (a steel plate or washers, which can only be misplaced, ${num(r['steel-loss'])}) · a laptop failure or losing an account ${num(r.total.device)} · fire, flood or death ${num(r.fire)} (fire or flood at a bank box ${num(r['vault-disaster'])}) · incapacity ${num(r.incapacity)} · losing access to a place ${num(r.total.physical)}.`,
        `Several loss events at once add up their rarities (like multiplying probabilities). The combinations of up to ${hasta} after which nobody could ever recover the funds are searched for; the rarer the most likely one, the higher the score: ${[1, 2, 3, 4, 5, 6].map((x) => `${x}${x === 6 ? ' or more' : ''} → ${rarityScore(x)}`).join(' · ')}.`,
        'The other routes count too: their probabilities add up, and the score comes from the equivalent rarity of all of them together.',
        `A temporary lockout (funds frozen while someone is incapacitated) loses nothing, but subtracts: ${LOCKOUT_PENALTY.map((p) => `rarity below ${num(p.below)} −${p.points}`).join(' · ')}.`,
        `A multisig without any copy of the descriptor subtracts ${NO_DESCRIPTOR_PENALTY.resilience}: the seeds give the xpubs, but not how they are combined (script type, k of n, derivation), and rebuilding the wallet that way is hard or, with unusual derivations, almost impossible.`,
      ];
    },
  },

  usabilidad: {
    noPueden: 'The owners cannot sign safely',
    firmarExige: (n: number) => `Signing requires going to ${plural(n, ...UBICACIONES)}`,
    como: () => [
      'How many locations the owners have to visit to sign safely: with signing devices, without typing any seed phrase into a computer.',
      `${scale(usabilityScore, UBICACIONES, 1, 4)}.`,
    ],
    dondeSeFirma: 'Where signing happens',
    minimoVisitar: 'The least the owners have to visit to sign a transaction:',
    quienes: 'With everything within their reach, the owners',
  },

  herencia: {
    recuperan: (conHerederos: boolean, n: number) => `${conHerederos ? 'The heirs recover' : 'Recovered'} by going to ${plural(n, ...UBICACIONES)}`,
    sinHerederos: 'There are no heirs',
    noRecuperan: 'The heirs cannot recover the funds',
    sinDescriptor: 'No descriptor: the heirs would have to rebuild the wallet from the seeds',
    fragilidad: (formas: number, rareza: number, juntas: number | null) =>
      `Fragility: ${plural(formas, 'way', 'ways')} of ending up without the funds; the most likely, rarity ${num(rareza)}${juntas !== null ? `, all together ${num(juntas)}` : ''}`,
    como: () => [
      'After the death of all the owners, whether the heirs can recover the funds with what is within their reach (including "after death" access), and how many locations it takes them.',
      `${scale(inheritanceScore, UBICACIONES, 1, 4)}.`,
      `Then the fragility of that path is subtracted. Death is certain, so it is taken for granted and the loss events that would, on top of it, leave the heirs without the funds are searched for (losing the only copy, a fire, the heir dying…). Its robustness is scored like resilience, and ${num(HEIR_FRAGILITY_WEIGHT)} × what it lacks to reach 100 is subtracted: at most ${num(Math.round(HEIR_FRAGILITY_WEIGHT * 100))}.`,
      `In a multisig, if the heirs cannot reach any copy of the descriptor (nor a device with the wallet registered that they can unlock), ${NO_DESCRIPTOR_PENALTY.inheritance} is subtracted: they would have to rebuild the wallet from the seeds without knowing the script type or the derivation. If there is a route with a descriptor, that one is chosen even if it takes one more trip.`,
    ],
    titulo: 'Heirs',
    nadieMas:
      'Nobody but the owners can get to the funds. To model inheritance, mark a person as an heir in their panel (Setup › People) and give them access to some location, for example "after the death" of the owner.',
    trasFallecer: 'After the death of the owners,',
    yendoA: ', by going to:',
    simular: 'Simulate the death on the map',
    losHerederos: 'The heirs',
    quienesQuedan: 'With everything within their reach, whoever is left',
  },

  porQue: 'Why',
  soloFirman: { antes: (quien: string) => `${quien} can only sign with`, despues: (n: number) => `, and ${n} are needed.` },
  ningunaKey: 'no key',
  faltanXpubs: ' They have enough signatures, but lack xpubs to build the transaction (the descriptor).',

  carta: {
    titulo: 'Letter for the heirs',
    sinDescriptor:
      'The heirs do not recover the funds because they cannot reach any copy of the descriptor. Keep one where they can reach it (for example the "Descriptor PDF", from Setup › Wallet descriptor) and the letter will be available.',
    explicacion:
      'A letter to print with what the heirs need: what to gather and where (only what they use), who to turn to and the steps, in plain words. It never contains secrets. Real names and a personal message are typed on the spot and not saved.',
    preparar: 'Prepare the letter',
  },
};
