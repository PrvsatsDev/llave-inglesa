import type { CustodyModel, Device } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, attackAtoms, compromisedDevices, createWorld, simulateAttack, TAMPERED_DEVICE_EFFORT, tamperRisk } from '../src/index.ts';
import { base, loadFixture, parse } from './helpers.ts';

/** Single-sig: un Trezor con K1 en casa, con esta procedencia. */
function trezor(origin?: Device['origin'], model = 'Trezor Safe 5'): CustodyModel {
  return parse(base({
    keys: [{ id: 'k1', label: 'K1' }],
    policy: { type: 'key', key: 'k1' },
    devices: [{ id: 't', label: 'Trezor', vendor: 'Trezor', model, kind: 'stateful', holds: ['k1'], pinProtected: true, location: 'casa', ...(origin && { origin }) }],
    people: [{ id: 'yo', name: 'Yo', role: 'owner', knows: [{ type: 'pin', device: 't' }] }],
  }));
}
const device = (m: CustodyModel) => m.devices[0]!;
const tampered = { type: 'tampered-device', device: 't' } as const;

describe('procedencia del dispositivo', () => {
  it('sin indicar, del fabricante con el precinto intacto o montado en casa: no hay ataque y la seguridad no cambia', () => {
    const plain = analyze(trezor()).security.score;
    for (const origin of [undefined, { source: 'manufacturer' as const, seal: 'intact' as const }, { seal: 'intact' as const }]) {
      const m = trezor(origin);
      expect(tamperRisk(device(m))).toBeNull();
      expect(attackAtoms(createWorld(m)).some((a) => a.type === 'tampered-device')).toBe(false);
      expect(analyze(m).security.score).toBe(plain);
    }
    expect(tamperRisk(device(trezor({ assembly: 'self', source: 'second-hand' }, 'SeedSigner')))).toBeNull();
  });

  it('montado en casa solo cuenta en los modelos que se pueden montar', () => {
    expect(tamperRisk(device(trezor({ assembly: 'self', source: 'second-hand' })))).toEqual({ reason: 'second-hand', effort: TAMPERED_DEVICE_EFFORT['second-hand'] });
  });

  it('cada procedencia cuesta lo suyo, y con varias cuenta la peor', () => {
    expect(tamperRisk(device(trezor({ source: 'official-reseller' }))!)).toEqual({ reason: 'official-reseller', effort: 4 });
    expect(tamperRisk(device(trezor({ source: 'unofficial-shop' }))!)).toEqual({ reason: 'unofficial-shop', effort: 2.5 });
    expect(tamperRisk(device(trezor({ seal: 'broken', source: 'official-reseller' }))!)).toEqual({ reason: 'seal', effort: 1.5 });
  });

  it('de segunda mano regala la semilla: en un single-sig, el robo más barato', () => {
    const m = trezor({ source: 'second-hand' });
    const d = simulateAttack(m, [tampered]);
    expect(d.canSpend).toBe(true);
    expect(d.facts.get('secret:seed:k1')!.justification).toMatchObject({ rule: 'tampered-device', via: { device: 't', tamper: 'second-hand' } });
    expect(analyze(m).security.minEffort).toBe(TAMPERED_DEVICE_EFFORT['second-hand']);
    expect(analyze(m).security.score).toBeLessThan(analyze(trezor()).security.score);
    expect(compromisedDevices(createWorld(m), [tampered])).toEqual(new Map([['t', 'tampered']]));
  });

  it('en un multisig cuesta una key: hace falta otra vía para la segunda', () => {
    const r = loadFixture('referencia/r09-2de3-distribuido');
    const m = { ...r, devices: r.devices.map((d, i) => (i === 0 ? { ...d, origin: { source: 'second-hand' as const } } : d)) };
    expect(simulateAttack(m, [{ type: 'tampered-device', device: m.devices[0]!.id }]).canSpend).toBe(false);
  });
});
