import { describe, expect, it } from 'vitest';
import { analyze, BURGLARY_EFFORT, CLOUD_BREACH_EFFORT } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

/** Galería de esquemas de referencia (docs/CALIBRACION.md): lo ya acordado con el motor. */
const score = (name: string) => analyze(loadFixture(`referencia/${name}`));

describe('calibración: esquemas de referencia', () => {
  const r01 = score('r01-papel-en-casa');
  const r02 = score('r02-foto-en-la-nube');

  it('hackear una nube es más barato que entrar en una casa', () => {
    expect(CLOUD_BREACH_EFFORT).toBeLessThan(BURGLARY_EFFORT.none);
  });

  it('R02: el robo más barato es hackear iCloud, y nadie puede heredar', () => {
    expect(r02.security.cheapest).toEqual([[{ type: 'burglary', location: 'nueva-ubicacion' }]]);
    expect(r02.security.minEffort).toBe(CLOUD_BREACH_EFFORT);
    expect(r02.inheritance.score).toBe(0);
  });

  it('R01 ≈ R02 en seguridad: papel a la vista y foto en la nube, igual de malos', () => {
    expect(r01.security.score).toBeLessThan(25);
    expect(r02.security.score).toBeLessThan(25);
    expect(Math.abs(r01.security.score - r02.security.score)).toBeLessThanOrEqual(5);
  });
});
