import { updateDevice } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, simulateAttack, type AttackAtom } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

describe('todo en casa (Coldcard Q con K1 + metal K2 + SeedSigner en casa)', () => {
  const model = loadFixture('todo-en-casa');
  const a = analyze(model);

  it('se firma desde una sola ubicación: máxima usabilidad', () => {
    expect(a.usability.locations).toEqual(['casa']);
    expect(a.usability.score).toBe(100);
  });

  it('una llave inglesa en casa basta para robar: baja seguridad', () => {
    expect(a.security.minSize).toBe(1);
    expect(a.security.cuts.filter((c) => c.length === 1)).toEqual([
      [{ type: 'coercion', person: 'yo', location: 'casa' }],
    ]);
    expect(a.security.score).toBeLessThan(50);
  });

  it('un ladrón en casa sin el PIN no puede robar', () => {
    expect(simulateAttack(model, [{ type: 'burglary', location: 'casa' }]).canSpend).toBe(false);
  });

  it('comprometer el RNG de Coinkite expone K1 y K3, pero sin descriptor no se puede gastar', () => {
    const coinkite: AttackAtom = { type: 'entropy-compromise', origin: { kind: 'vendor', vendor: 'Coinkite' } };
    const d = simulateAttack(model, [coinkite]);
    expect([...d.signable].sort()).toEqual(['k1', 'k3']);
    expect(d.canSpend).toBe(false);
    expect(simulateAttack(model, [coinkite, { type: 'burglary', location: 'padres' }]).canSpend).toBe(true);
  });

  it('K2 (dados verificados) resiste un RNG comprometido de SeedSigner', () => {
    const d = simulateAttack(model, [{ type: 'entropy-compromise', origin: { kind: 'vendor', vendor: 'SeedSigner' } }]);
    expect(d.signable.size).toBe(0);
  });

  it('la incapacidad del titular deja a la pareja sin acceso al banco: pérdida', () => {
    expect(a.resilience.cuts).toContainEqual([{ type: 'incapacity', person: 'yo' }]);
  });

  it('desactivar y reactivar el PIN deja el análisis igual (nada se pierde)', () => {
    const roundTrip = updateDevice(updateDevice(model, 'ccq', { pinProtected: false }), 'ccq', { pinProtected: true });
    expect(analyze(roundTrip)).toEqual(a);
  });

  it('sin PIN, un ladrón en casa ya puede robar', () => {
    const noPin = updateDevice(model, 'ccq', { pinProtected: false });
    expect(simulateAttack(noPin, [{ type: 'burglary', location: 'casa' }]).canSpend).toBe(true);
  });

  it('la llave inglesa como única vía es débil, pero no tanto como robar sin confrontación', () => {
    expect(a.security.minEffort).toBe(2);
    expect(a.security.cheapRoutes).toBe(1);
    expect(a.security.score).toBeGreaterThan(25);
  });

  it('sin PIN la seguridad cae por debajo de 25: vías más fáciles y más numerosas', () => {
    const noPin = analyze(updateDevice(model, 'ccq', { pinProtected: false }));
    expect(noPin.security.minEffort).toBe(1.5);
    expect(noPin.security.cheapRoutes).toBeGreaterThan(1);
    expect(noPin.security.score).toBeLessThan(25);
    expect(noPin.security.cheapest).toContainEqual([{ type: 'burglary', location: 'casa' }]);
  });

  it('la herencia funciona: la pareja recupera con casa + banco', () => {
    expect(a.inheritance.status).toBe('ok');
    expect(a.inheritance.locations).toHaveLength(2);
  });
});

describe('distribuido 2 de 3', () => {
  const a = analyze(loadFixture('distribuido-2de3'));

  it('ninguna acción aislada permite robar', () => {
    expect(a.security.minSize).toBe(2);
  });

  it('es más seguro que tenerlo todo en casa', () => {
    expect(a.security.score).toBeGreaterThan(analyze(loadFixture('todo-en-casa')).security.score);
  });

  it('firmar exige visitar dos ubicaciones', () => {
    expect(a.usability.locations).toHaveLength(2);
  });

  it('la incapacidad del titular no pierde los fondos (pareja + hermano)', () => {
    expect(a.resilience.cuts).not.toContainEqual([{ type: 'incapacity', person: 'yo' }]);
    expect(a.resilience.minSize).toBe(2);
  });
});

describe('single-sig + passphrase', () => {
  const model = loadFixture('singlesig-passphrase');

  it('el RNG comprometido no basta: falta la passphrase', () => {
    const d = simulateAttack(model, [{ type: 'entropy-compromise', origin: { kind: 'vendor', vendor: 'coinkite' } }]);
    expect(d.has({ kind: 'secret', secret: { type: 'seed', key: 'k1' } })).toBe(true);
    expect(d.canSpend).toBe(false);
  });

  it('semilla (banco) + passphrase (padres) sí', () => {
    const d = simulateAttack(model, [
      { type: 'burglary', location: 'banco' },
      { type: 'burglary', location: 'padres' },
    ]);
    expect(d.canSpend).toBe(true);
  });

  it('coacción al titular en casa basta (dispositivo + PIN + passphrase memorizada)', () => {
    expect(analyze(model).security.minSize).toBe(1);
  });
});
