import { describe, expect, it } from 'vitest';
import { analyze, BURGLARY_EFFORT, CLOUD_BREACH_EFFORT } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

/** Galería de esquemas de referencia (docs/CALIBRACION.md): el orden ya acordado con el motor. */
const score = (name: string) => analyze(loadFixture(`referencia/${name}`));
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(5);

describe('calibración: esquemas de referencia', () => {
  const r01 = score('r01-papel-en-casa');
  const r02 = score('r02-foto-en-la-nube');
  const r03 = score('r03-acero-en-caja-fuerte');
  const r04 = score('r04-acero-y-banco');
  const r05 = score('r05-passphrase-copia-aparte');

  it('hackear una nube es más barato que entrar en una casa', () => {
    expect(CLOUD_BREACH_EFFORT).toBeLessThan(BURGLARY_EFFORT.none);
  });

  it('R02: el robo más barato es hackear iCloud, y nadie puede heredar', () => {
    expect(r02.security.cheapest).toEqual([[{ type: 'burglary', location: 'nueva-ubicacion' }]]);
    expect(r02.security.minEffort).toBe(CLOUD_BREACH_EFFORT);
    expect(r02.inheritance.score).toBe(0);
  });

  it('seguridad: R02 < R01 < R03 ≈ R04 < R05', () => {
    expect(r02.security.score).toBeLessThan(r01.security.score);
    expect(r01.security.score).toBeLessThan(r03.security.score);
    near(r03.security.score, r04.security.score);
    expect(r04.security.score).toBeLessThan(r05.security.score);
  });

  it('resiliencia: R01 < R03 < R04, y R05 < R03', () => {
    expect(r01.resilience.score).toBeLessThan(r03.resilience.score);
    expect(r03.resilience.score).toBeLessThan(r04.resilience.score);
    expect(r05.resilience.score).toBeLessThan(r03.resilience.score);
  });

  it('herencia: R05 < R01 < R03 < R04 (papel < acero < dos placas; la passphrase es otro punto único)', () => {
    expect(r05.inheritance.score).toBeLessThan(r01.inheritance.score);
    expect(r01.inheritance.score).toBeLessThan(r03.inheritance.score);
    expect(r03.inheritance.score).toBeLessThan(r04.inheritance.score);
  });

  it('herencia: con una sola placa, perderla basta; con dos, hay que perder las dos', () => {
    expect(r03.inheritance.losses[0]).toEqual([{ type: 'item-loss', item: 'nuevo-backup' }]);
    expect(r04.inheritance.losses).toContainEqual([{ type: 'item-loss', item: 'nuevo-backup' }, { type: 'item-loss', item: 'nuevo-backup-2' }]);
    expect(r04.inheritance.losses.some((c) => c.length === 1 && c[0]!.type === 'item-loss')).toBe(false);
  });
});
