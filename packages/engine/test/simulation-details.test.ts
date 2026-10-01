import { updateDevice } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { compromisedDevices, createWorld, duressObstacles, type AttackAtom } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

const casa = loadFixture('todo-en-casa'); // Coldcard Q (ccq) con K1 y PIN que sabe Yo; SeedSigner con K2
const wrench: AttackAtom[] = [{ type: 'coercion', person: 'yo', location: 'casa' }];

describe('PIN de coacción que hay que vencer', () => {
  it('sin PIN de coacción, nada que vencer', () => {
    expect(duressObstacles(createWorld(casa), wrench)).toEqual([]);
  });

  it('con PIN de coacción en la Coldcard Q, la llave inglesa a Yo tiene que vencerlo', () => {
    const duress = updateDevice(casa, 'ccq', { duressPin: true });
    expect(duressObstacles(createWorld(duress), wrench)).toEqual([{ person: 'yo', device: 'ccq' }]);
  });

  it('quien traiciona da el PIN bueno: no hay obstáculo', () => {
    const duress = updateDevice(casa, 'ccq', { duressPin: true });
    expect(duressObstacles(createWorld(duress), [{ type: 'burglary', location: 'casa' }])).toEqual([]);
  });
});

describe('dispositivos comprometidos en el mapa', () => {
  it('firmware malicioso: los dispositivos de ese fabricante por los que pasan semillas', () => {
    expect(compromisedDevices(createWorld(casa), [{ type: 'malicious-firmware', vendor: 'Coinkite' }])).toEqual(new Map([['ccq', 'firmware']]));
  });

  it('el anti-exfil lo evita', () => {
    const jade = updateDevice(casa, 'ccq', { vendor: 'Coinkite', model: 'Jade' });
    expect(compromisedDevices(createWorld(jade), [{ type: 'malicious-firmware', vendor: 'Coinkite' }]).size).toBe(0);
  });

  it('extracción física: el Trezor One alcanzado en el robo', () => {
    const singlesig = loadFixture('singlesig-passphrase');
    const trezor = updateDevice(singlesig, 'mk4', { vendor: 'Trezor', model: 'Trezor Model One', firmware: '1.12.1' });
    expect(compromisedDevices(createWorld(trezor), [{ type: 'burglary', location: 'casa' }])).toEqual(new Map([['mk4', 'extraction']]));
    expect(compromisedDevices(createWorld(singlesig), [{ type: 'burglary', location: 'casa' }]).size).toBe(0);
  });

  it('una llave inglesa no compromete ningún dispositivo', () => {
    expect(compromisedDevices(createWorld(casa), wrench).size).toBe(0);
  });
});
