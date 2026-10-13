import type { simular as es } from '../../es/interfaz/simular.ts';
import { comun } from './comun.ts';

const num = comun.numero;

/**
 * A simulation's panel: events, effort, privacy and the why. Sentences with a bold part come in pieces
 * (`antes`, `destacado`, `despues`) that the component joins.
 */
export const simular: typeof es = {
  resultado: {
    stolen: 'Theft possible',
    safe: 'The attacker falls short',
    recoverable: 'Funds recoverable',
    delay: 'Recoverable after waiting',
    lockout: 'Temporary lockout',
    lost: 'Permanent loss',
  },
  verArriba: '(see above)',
  quitarSuceso: 'Remove event',
  anadirSuceso: '+ Add another event at the same time…',
  unir: (nombres: readonly string[]) => nombres.join(' and '),
  esfuerzo: "Attacker's effort",
  asaltar: (n: number, sitios: string) => `Raiding ${n} different locations (${sitios})`,
  vencerCoaccion: (dispositivos: string) => `Defeating the duress PIN of ${dispositivos}`,
  total: 'Total',
  mismoAsalto: 'in the same raid',
  recargoCoaccion: { away: 'where they do not live: they have to be taken there', 'bank-box': 'they have to be taken to the bank', ninguno: '' },
  coaccion: {
    antes: (personas: string, varias: boolean) => `${personas} ${varias ? 'have' : 'has'} a`,
    destacado: 'duress PIN',
    despues: (dispositivos: string, recargo: number) =>
      `on ${dispositivos}: under threat they can give it instead of the real one, and the device opens a decoy wallet. The theft only works if the attacker knows it exists and forces them to give the real one; that is why it costs ${num(recargo)} more. It makes it more expensive, but does not prevent it.`,
  },
  comprometido: {
    firmware: (fabricante: string | null) =>
      `is compromised: malicious firmware from ${fabricante ?? 'its manufacturer'} leaks the seeds that go through it in the signatures. Only anti-exfil prevents this.`,
    extraccion: 'is compromised: with the device in hand, a published flaw allows extracting its seed even with a PIN. Only a passphrase protects it.',
    host: 'is compromised: it connects by cable or Bluetooth to a computer with malware and has a published flaw that allows attacking it from there. Updating the firmware or connecting it only by QR or microSD prevents this.',
    tampered: 'is compromised: it arrived tampered with (because of where it came from) and gives away the seeds that go through it. Buying it from the manufacturer with the seal intact or, where possible, assembling it at home prevents this.',
    malware: 'has malware: it reads the wallet (and with it the descriptor) and attacks the devices with a known flaw that connect to it.',
  },
  privacidad: {
    titulo: 'Privacy',
    ademas: 'What is more, ',
    aunque: 'Even if it cannot spend, ',
    antes: 'it knows all the xpubs: it can derive your addresses and see',
    destacado: 'your balance and your whole history',
    despues: 'of transactions. Knowing how much you have also makes you a more attractive target for a wrench attack.',
    noVe: 'It cannot see your funds: it lacks xpubs to derive your addresses.',
  },
  simulacion: 'Simulation',
  salir: 'Leave the simulation',
  ataques: 'Combined attacks',
  desgracias: 'Combined loss events',
  porQue: 'Why',
  elAtacante: 'The attacker',
  quienQueda: 'Whoever is left',
  soloFirma: 'can only sign with',
  ningunaKey: 'no key',
  hacenFalta: (n: number) => `, and ${n} are needed.`,
  trasIncapacidad: ' When the incapacitated people die, the heirs will be able to access what is missing.',
  faltanXpubs: ' It has enough signatures, but lacks xpubs to build the transaction (the descriptor).',
};
