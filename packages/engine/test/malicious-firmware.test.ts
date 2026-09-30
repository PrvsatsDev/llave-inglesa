import { updateDevice } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { attackAtoms, firmwareExposure, simulateAttack, createWorld, type AttackAtom } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

const firmware = (vendor: string): AttackAtom => ({ type: 'malicious-firmware', vendor });
const exposed = (m: Parameters<typeof firmwareExposure>[0]) => Object.fromEntries([...firmwareExposure(m).values()].map((e) => [e.vendor, e.keys.sort()]));

describe('firmware malicioso', () => {
  const casa = loadFixture('todo-en-casa'); // Coldcard Q con K1; SeedSigner con K2
  const distribuido = loadFixture('distribuido-2de3'); // un SeedSigner para las tres keys

  it('alcanza a lo que guarda un stateful y a lo que se carga en un stateless', () => {
    expect(exposed(casa)).toEqual({ Coinkite: ['k1'], SeedSigner: ['k2'] });
  });

  it('stateless sin indicar: ante la duda, cualquier semilla escrita puede pasar por él', () => {
    expect(exposed(distribuido)).toEqual({ SeedSigner: ['k1', 'k2', 'k3'] });
    expect(exposed(updateDevice(casa, 'seedsigner', { loads: undefined })).SeedSigner).toEqual(['k1', 'k2', 'k3']);
  });

  it('semilla externa en un stateful: solo si se indica', () => {
    const q = updateDevice(casa, 'ccq', { acceptsExternalSeed: true });
    expect(exposed(q).Coinkite).toEqual(['k1']);
    expect(exposed(updateDevice(q, 'ccq', { loads: ['k3'] })).Coinkite).toEqual(['k1', 'k3']);
  });

  it('el anti-exfil lo mitiga (Jade, BitBox02)', () => {
    const jade = updateDevice(distribuido, 'seedsigner', { vendor: 'Blockstream', model: 'Jade', kind: 'stateful', holds: ['k1'] });
    expect(exposed(jade)).toEqual({});
    expect(attackAtoms(createWorld(jade)).filter((a) => a.type === 'malicious-firmware')).toEqual([]);
  });

  it('filtra también semillas no generadas por ese fabricante (K2 salió de dados verificados)', () => {
    const d = simulateAttack(casa, [firmware('SeedSigner')]);
    expect(d.facts.get('secret:seed:k2')?.justification).toEqual({ rule: 'malicious-firmware', premises: [], via: { vendor: 'SeedSigner' } });
  });

  it('un fabricante solo no basta si las keys están repartidas entre marcas', () => {
    expect(simulateAttack(casa, [firmware('SeedSigner')]).signable).toEqual(new Set(['k2']));
    const both = simulateAttack(casa, [firmware('Coinkite'), firmware('SeedSigner')]);
    expect([...both.signable].sort()).toEqual(['k1', 'k2']);
    expect(both.canSpend).toBe(false); // falta la xpub de K3: el descriptor sigue protegiendo
  });

  it('con un solo SeedSigner para todo, basta con su firmware', () => {
    expect(simulateAttack(distribuido, [firmware('SeedSigner')]).canSpend).toBe(true);
  });
});
