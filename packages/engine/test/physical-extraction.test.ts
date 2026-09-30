import { updateDevice, updateKey } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, extractionAdvisory, simulateAttack, simulateLosses } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

// singlesig-passphrase: K1 en un dispositivo con PIN en casa, passphrase memorizada y en papel en casa de los padres.
const coldcard = loadFixture('singlesig-passphrase');
const trezor = updateDevice(coldcard, 'mk4', { vendor: 'Trezor', model: 'Trezor Model One', firmware: '1.12.1' });
const trezorNoPass = updateKey(trezor, 'k1', { passphrase: false });
const casa = [{ type: 'burglary', location: 'casa' }] as const;

describe('extracción física (Trezor One/T)', () => {
  it('solo afecta a los modelos con el aviso', () => {
    expect(extractionAdvisory(trezor.devices[0]!)).toBe('trezor-glitch-2020');
    expect(extractionAdvisory(coldcard.devices[0]!)).toBeNull();
    expect(extractionAdvisory({ ...trezor.devices[0]!, model: 'Trezor Safe 3' })).toBeNull();
  });

  it('robar el dispositivo da la semilla aunque tenga PIN', () => {
    const d = simulateAttack(trezor, casa);
    expect(d.has({ kind: 'unlocked', device: 'mk4' })).toBe(false);
    expect(d.facts.get('secret:seed:k1')?.justification).toEqual({
      rule: 'physical-extraction',
      premises: ['item:mk4'],
      via: { device: 'mk4', advisory: 'trezor-glitch-2020' },
    });
  });

  it('con una Coldcard, el PIN sigue protegiendo', () => {
    expect(simulateAttack(coldcard, casa).has({ kind: 'secret', secret: { type: 'seed', key: 'k1' } })).toBe(false);
  });

  it('la passphrase protege: con la semilla sola no se gasta', () => {
    expect(simulateAttack(trezor, casa).canSpend).toBe(false);
    expect(simulateAttack(trezorNoPass, casa).canSpend).toBe(true);
  });

  it('sin passphrase, entrar en casa basta: la seguridad cae', () => {
    const withPin = analyze(updateDevice(updateKey(coldcard, 'k1', { passphrase: false }), 'mk4', {})).security;
    const extracted = analyze(trezorNoPass).security;
    expect(extracted.cheapest).toContainEqual([...casa]);
    expect(extracted.score).toBeLessThan(withPin.score);
  });

  it('no cuenta como recuperación: olvidar el PIN no se arregla con un hack', () => {
    const legit = simulateLosses(trezor, [{ type: 'forget', person: 'yo' }]);
    expect(legit.facts.get('secret:seed:k1')?.justification.rule).not.toBe('physical-extraction');
    expect(analyze(trezor).resilience).toEqual(analyze(updateDevice(trezor, 'mk4', { model: 'Trezor Safe 3' })).resilience);
  });
});
