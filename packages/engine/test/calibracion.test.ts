import { readdirSync } from 'node:fs';
import { tidyIds } from '@llave-inglesa/domain';
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
  const r06 = score('r06-passphrase-solo-memoria');
  const r07 = score('r07-coldcard-afectada');
  const r08 = score('r08-2de3-todo-en-casa');
  const r09 = score('r09-2de3-distribuido');
  const r10 = score('r10-2de3-custodio');
  const r11 = score('r11-2de3-sin-herencia');
  const r12 = score('r12-2de3-seedsigner');

  it('hackear una nube es más barato que entrar en una casa', () => {
    expect(CLOUD_BREACH_EFFORT).toBeLessThan(BURGLARY_EFFORT.none);
  });

  it('R02: el robo más barato es hackear iCloud, y nadie puede heredar', () => {
    expect(r02.security.cheapest).toEqual([[{ type: 'burglary', location: 'nueva-ubicacion' }]]);
    expect(r02.security.minEffort).toBe(CLOUD_BREACH_EFFORT);
    expect(r02.inheritance.score).toBe(0);
  });

  it('seguridad: R07 < R02 < R01 < R03 ≈ R04 < R05 < R06; R08 < R09; R03 < R09', () => {
    expect(r07.security.score).toBeLessThan(r02.security.score);
    expect(r02.security.score).toBeLessThan(r01.security.score);
    expect(r01.security.score).toBeLessThan(r03.security.score);
    near(r03.security.score, r04.security.score);
    expect(r04.security.score).toBeLessThan(r05.security.score);
    expect(r05.security.score).toBeLessThan(r06.security.score);
    expect(r08.security.score).toBeLessThan(r09.security.score);
    expect(r03.security.score).toBeLessThan(r09.security.score);
  });

  it('solo la llave inglesa en casa: alrededor de 75', () => {
    expect(r06.security.cuts).toEqual([[{ type: 'coercion', person: 'yo', location: 'casa' }]]);
    expect(r06.security.score).toBeGreaterThanOrEqual(70);
  });

  it('resiliencia: R06 < R03 < R04; R01 < R03; R05 < R03; R08 < R09', () => {
    expect(r06.resilience.score).toBeLessThan(r03.resilience.score);
    expect(r08.resilience.score).toBeLessThan(r09.resilience.score);
    expect(r01.resilience.score).toBeLessThan(r03.resilience.score);
    expect(r03.resilience.score).toBeLessThan(r04.resilience.score);
    expect(r05.resilience.score).toBeLessThan(r03.resilience.score);
  });

  it('herencia: R02 y R06 no se pueden heredar', () => {
    expect(r02.inheritance.score).toBe(0);
    expect(r06.inheritance.score).toBe(0);
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

  it('R10 ≈ R09: el custodio solo tiene una key y no abre vías baratas', () => {
    near(r10.security.score, r09.security.score);
    near(r10.resilience.score, r09.resilience.score);
    near(r10.inheritance.score, r09.inheritance.score);
    expect(r10.security.cheapest).toEqual(r09.security.cheapest);
  });

  it('R11: tan seguro como R09, pero sin herencia y menos resiliente', () => {
    expect(r11.security.score).toBe(r09.security.score);
    expect(r11.resilience.score).toBeLessThan(r09.resilience.score);
    expect(r11.resilience.cheapest).toEqual([[{ type: 'death', person: 'yo' }]]);
    expect(r11.inheritance.score).toBe(0);
  });

  it('R12: todo pasa por una SeedSigner; menos seguro, resiliente y usable que R09', () => {
    expect(r12.security.cheapest).toEqual([[{ type: 'malicious-firmware', vendor: 'SeedSigner' }]]);
    expect(r12.security.score).toBeLessThan(r09.security.score);
    expect(r12.resilience.score).toBeLessThan(r09.resilience.score);
    expect(r12.usability.score).toBeLessThan(r09.usability.score);
  });

  describe('bandas esperadas (docs/CALIBRACION.md)', () => {
    type Band = 'muy mal' | 'flojo' | 'aceptable' | 'bueno' | 'excelente';
    const RANGE: Record<Band, [number, number]> = {
      'muy mal': [0, 25],
      flojo: [25, 50],
      aceptable: [50, 70],
      bueno: [70, 85],
      excelente: [85, 101],
    };
    // Seguridad · Resiliencia · Usabilidad · Herencia; una lista admite varias bandas.
    const BANDS: Record<string, [Band | Band[], Band, Band, Band]> = {
      'r01-papel-en-casa': [['muy mal', 'flojo'], 'flojo', 'excelente', 'bueno'],
      'r02-foto-en-la-nube': ['muy mal', 'flojo', 'excelente', 'muy mal'],
      // Seguridad en el borde (49): generada en el Trezor mezclando dados, sin verificar (ver docs/CALIBRACION.md).
      'r03-acero-en-caja-fuerte': [['flojo', 'aceptable'], 'aceptable', 'excelente', 'bueno'],
      'r04-acero-y-banco': [['flojo', 'aceptable'], 'bueno', 'excelente', 'bueno'],
      'r05-passphrase-copia-aparte': ['bueno', 'flojo', 'excelente', 'aceptable'],
      'r06-passphrase-solo-memoria': ['bueno', 'flojo', 'excelente', 'muy mal'],
      'r07-coldcard-afectada': ['muy mal', 'aceptable', 'excelente', 'bueno'],
      'r08-2de3-todo-en-casa': ['aceptable', 'aceptable', 'excelente', 'bueno'],
      'r09-2de3-distribuido': ['bueno', 'bueno', 'excelente', 'bueno'],
      'r10-2de3-custodio': ['bueno', 'bueno', 'excelente', 'bueno'],
      'r11-2de3-sin-herencia': ['bueno', 'aceptable', 'excelente', 'muy mal'],
      'r12-2de3-seedsigner': ['aceptable', 'aceptable', 'bueno', 'bueno'],
    };
    const inBand = (value: number, band: Band | Band[]) => [band].flat().some((b) => value >= RANGE[b][0] && value < RANGE[b][1]);

    for (const [name, [sec, res, usa, inh]] of Object.entries(BANDS)) {
      it(name, () => {
        const a = score(name);
        const actual = { seguridad: a.security.score, resiliencia: a.resilience.score, usabilidad: a.usability.score, herencia: a.inheritance.score };
        const expected = { seguridad: sec, resiliencia: res, usabilidad: usa, herencia: inh };
        for (const metric of Object.keys(actual) as (keyof typeof actual)[]) {
          expect(inBand(actual[metric], expected[metric]), `${metric}: ${actual[metric]} fuera de ${[expected[metric]].flat().join(' / ')}`).toBe(true);
        }
      });
    }
  });

  it('con un solo heredero, la herencia no pasa de ~84: su fallecimiento siempre cuenta', () => {
    for (const r of [r04, r08, r09, r10]) expect(r.inheritance.score).toBeLessThan(85);
  });
});

describe('ordenar los ids al exportar no cambia nada del análisis', () => {
  const names = readdirSync(new URL('../../../fixtures/referencia/', import.meta.url)).map((f) => f.replace(/\.json$/, ''));
  it.each(names)('%s', (name) => {
    const model = loadFixture(`referencia/${name}`);
    const scores = (a: ReturnType<typeof analyze>) => [a.security.score, a.resilience.score, a.usability.score, a.inheritance.score];
    expect(scores(analyze(tidyIds(model)))).toEqual(scores(analyze(model)));
  });
});
