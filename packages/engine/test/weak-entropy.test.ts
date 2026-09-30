import { updateKey, type CustodyModel, type EntropySource, type Key } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, ATTACK_EFFORT, ownEntropyBits, simulateAttack, weakEntropyKeys, type AttackAtom } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

const coldcard2026: AttackAtom = { type: 'known-weak-entropy', advisory: 'coldcard-rng-2026' };

/** Cambia el firmware con el que se generó una key (undefined = desconocido). */
function generatedWith(model: CustodyModel, key: string, firmware: string | undefined, sources?: EntropySource[]): CustodyModel {
  const k = model.keys.find((x) => x.id === key)!;
  const provenance: Key['provenance'] = { ...k.provenance, generatedBy: { ...k.provenance.generatedBy!, firmware }, ...(sources && { sources }) };
  return updateKey(model, key, { provenance });
}

describe('entropía propia', () => {
  it('50 dados, 128 monedas o 26 cartas superan los 128 bits', () => {
    expect(ownEntropyBits([{ kind: 'dice', count: 50 }])).toBeGreaterThanOrEqual(128);
    expect(ownEntropyBits([{ kind: 'dice', count: 49 }])).toBeLessThan(128);
    expect(ownEntropyBits([{ kind: 'coin', count: 128 }])).toBe(128);
    expect(ownEntropyBits([{ kind: 'cards', count: 26 }])).toBeGreaterThanOrEqual(128);
  });

  it('sin número de tiradas, o de un RNG, no cuenta', () => {
    expect(ownEntropyBits([{ kind: 'dice' }, { kind: 'device-rng', vendor: 'Coinkite' }, { kind: 'unknown' }])).toBe(0);
  });

  it('las fuentes se suman', () => {
    expect(ownEntropyBits([{ kind: 'coin', count: 64 }, { kind: 'coin', count: 64 }])).toBe(128);
  });
});

describe('fallo de entropía de Coldcard (2026)', () => {
  const casa = loadFixture('todo-en-casa');

  it('con firmware corregido no hay átomo', () => {
    expect(weakEntropyKeys(casa).size).toBe(0);
    expect(analyze(casa).security.cuts.flat()).not.toContainEqual(coldcard2026);
  });

  it('firmware afectado o desconocido: la key queda expuesta', () => {
    expect([...weakEntropyKeys(generatedWith(casa, 'k3', '5.5.2'))]).toEqual([['coldcard-rng-2026', ['k3']]]);
    expect([...weakEntropyKeys(generatedWith(casa, 'k3', undefined))]).toEqual([['coldcard-rng-2026', ['k3']]]);
    expect(weakEntropyKeys(generatedWith(casa, 'k3', '5.6.0')).size).toBe(0);
  });

  it('cualquier cosa que no sea una versión completa y conocida cuenta como afectada', () => {
    for (const fw of ['0', '3', '5', '7', '10', '5.', '5.6', 'abc', '1.5.0Q']) {
      expect(weakEntropyKeys(generatedWith(casa, 'k3', fw)).get('coldcard-rng-2026'), fw).toEqual(['k3']);
    }
  });

  it('una versión de otro modelo no se da por buena', () => {
    expect(weakEntropyKeys(generatedWith(casa, 'k3', '1.5.0Q')).get('coldcard-rng-2026')).toEqual(['k3']); // versión de Q en una Mk4
  });

  it('50 dados propios lo mitigan; 20 no', () => {
    expect(weakEntropyKeys(generatedWith(casa, 'k1', '1.4.0Q')).size).toBe(0); // K1 lleva 99 dados
    const few = generatedWith(casa, 'k1', '1.4.0Q', [{ kind: 'device-rng', vendor: 'Coinkite' }, { kind: 'dice', count: 20 }]);
    expect(weakEntropyKeys(few).get('coldcard-rng-2026')).toEqual(['k1']);
  });

  it('un solo ataque expone a la vez todas las keys afectadas', () => {
    const both = generatedWith(generatedWith(casa, 'k3', '5.5.2'), 'k1', '1.4.0Q', [{ kind: 'device-rng', vendor: 'Coinkite' }]);
    const d = simulateAttack(both, [coldcard2026]);
    expect([...d.signable].sort()).toEqual(['k1', 'k3']);
  });

  it('se explica: la semilla sale del fallo publicado, sin acceso físico', () => {
    const d = simulateAttack(generatedWith(casa, 'k3', '5.5.2'), [coldcard2026]);
    const seed = d.facts.get('secret:seed:k3');
    expect(seed?.justification).toEqual({ rule: 'known-weak-entropy', premises: [], via: { advisory: 'coldcard-rng-2026' } });
  });

  it('abarata el robo: una intrusión sin confrontación basta y hay más vías', () => {
    const before = analyze(casa).security;
    const after = analyze(generatedWith(casa, 'k3', '5.5.2')).security;
    expect(after.cheapest).toContainEqual([{ type: 'burglary', location: 'casa' }, coldcard2026]);
    expect(after.score).toBeLessThan(before.score);
  });

  it('es el ataque más barato que existe', () => {
    const others = Object.entries(ATTACK_EFFORT).filter(([type]) => type !== 'known-weak-entropy');
    for (const [, effort] of others) expect(ATTACK_EFFORT['known-weak-entropy']).toBeLessThan(effort);
  });

  it('la passphrase protege: con la semilla sola no se firma', () => {
    const single = generatedWith(loadFixture('singlesig-passphrase'), 'k1', '5.5.2');
    expect(simulateAttack(single, [coldcard2026]).signable.size).toBe(0);
    expect(simulateAttack(single, [coldcard2026]).has({ kind: 'secret', secret: { type: 'seed', key: 'k1' } })).toBe(true);
  });

  it('256 lanzamientos de moneda también lo mitigan (K3 de distribuido-2de3)', () => {
    expect(weakEntropyKeys(generatedWith(loadFixture('distribuido-2de3'), 'k3', '5.5.2')).size).toBe(0);
  });
});
