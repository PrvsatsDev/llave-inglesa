import { setWallet, updateDevice, type CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, createWorld, attackAtoms, firmwareExposure, TAPROOT_DEVICE_PENALTY } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

/** Single-sig con un Trezor Safe 5 (firma Taproot) y la semilla en acero. */
const acero = loadFixture('referencia/r03-acero-en-caja-fuerte');
const tr = (m: CustodyModel) => setWallet(m, { script: 'tr', sorted: true });
const dispositivo = acero.devices[0]!.id;

describe('cartera Taproot (tr)', () => {
  it('sin cartera Taproot no hay lista de dispositivos que no la firman (los modelos de antes no cambian)', () => {
    expect(analyze(acero).usability.noTaproot).toBeUndefined();
  });

  it('un dispositivo que firma Taproot no resta', () => {
    const a = analyze(tr(acero));
    expect(a.usability.noTaproot).toEqual([]);
    expect(a.usability.score).toBe(analyze(acero).usability.score);
  });

  it('uno que no lo firma (o no con su firmware) resta, y nada más cambia', () => {
    const viejo = updateDevice(acero, dispositivo, { vendor: 'Trezor', model: 'Trezor Model T', firmware: '2.4.2' });
    const tapsigner = updateDevice(acero, dispositivo, { vendor: 'Coinkite', model: 'Tapsigner' });
    for (const m of [viejo, tapsigner]) {
      const [antes, ahora] = [analyze(m), analyze(tr(m))];
      expect(ahora.usability.noTaproot).toEqual([dispositivo]);
      expect(ahora.usability.score).toBe(antes.usability.score - TAPROOT_DEVICE_PENALTY);
      expect(ahora.security).toEqual(antes.security);
      expect(ahora.resilience).toEqual(antes.resilience);
      expect(ahora.inheritance).toEqual(antes.inheritance);
    }
  });

  it('Coldcard: Taproot solo con el firmware Edge', () => {
    const cc = (firmware?: string) =>
      analyze(tr(updateDevice(acero, dispositivo, { vendor: 'Coinkite', model: 'Coldcard Mk4', ...(firmware && { firmware }) }))).usability.noTaproot;
    expect(cc('5.4.0')).toEqual([dispositivo]);
    expect(cc('6.3.5')).toEqual([]);
    expect(cc()).toEqual([]);
  });

  it('el anti-exfil de BitBox02 no protege las firmas Schnorr: con Taproot, su firmware malicioso sí filtra', () => {
    const bitbox = updateDevice(acero, dispositivo, { vendor: 'BitBox', model: 'BitBox02' });
    expect([...firmwareExposure(bitbox).keys()]).toEqual([]);
    expect([...firmwareExposure(tr(bitbox)).values()]).toEqual([{ vendor: 'BitBox', keys: ['k1'] }]);
    expect(attackAtoms(createWorld(tr(bitbox)))).toContainEqual({ type: 'malicious-firmware', vendor: 'BitBox' });
  });
});
