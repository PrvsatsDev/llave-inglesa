import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ADVISORIES, HARDWARE_MODELS, advisoriesFor, catalogModelByName, compareFirmware, findModel, parseFirmware } from '../src/index.ts';

const ids = (matches: ReturnType<typeof advisoriesFor>) => matches.map((m) => m.advisory.id);

describe('catálogo: integridad', () => {
  it('ids de modelos y avisos únicos', () => {
    expect(new Set(HARDWARE_MODELS.map((m) => m.id)).size).toBe(HARDWARE_MODELS.length);
    expect(new Set(ADVISORIES.map((a) => a.id)).size).toBe(ADVISORIES.length);
  });

  it('los avisos solo citan modelos del catálogo', () => {
    for (const a of ADVISORIES) for (const r of a.affects) for (const m of r.models) expect(findModel(m), `${a.id} → ${m}`).toBeDefined();
  });

  it('los rangos de firmware se pueden leer y no están vacíos', () => {
    for (const a of ADVISORIES) {
      for (const r of a.affects) {
        const from = r.from ? parseFirmware(r.from) : null;
        const fixed = r.fixedIn ? parseFirmware(r.fixedIn) : null;
        if (r.from) expect(from, `${a.id} from`).not.toBeNull();
        if (r.fixedIn) expect(fixed, `${a.id} fixedIn`).not.toBeNull();
        if (from && fixed) expect(compareFirmware(from, fixed), a.id).toBeLessThan(0);
      }
      expect(a.disclosed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.sources.length).toBeGreaterThan(0);
    }
  });

  it('encuentra modelos por nombre, como los guardan los fixtures', () => {
    expect(catalogModelByName('Coldcard Mk4')?.id).toBe('coldcard-mk4');
    expect(catalogModelByName('  coldcard   q ')?.id).toBe('coldcard-q');
    expect(catalogModelByName('Jade')?.id).toBe('jade');
    expect(catalogModelByName('Mi cacharro')).toBeUndefined();
    expect(catalogModelByName(undefined)).toBeUndefined();
  });

  it('los stateless aceptan semilla externa', () => {
    for (const m of HARDWARE_MODELS) if (m.kind === 'stateless') expect(m.acceptsExternalSeed, m.id).toBe(true);
  });
});

describe('versiones de firmware', () => {
  it('lee los formatos de los fabricantes', () => {
    expect(parseFirmware('5.6.0')).toEqual([5, 6, 0]);
    expect(parseFirmware('1.5.0Q')).toEqual([1, 5, 0]);
    expect(parseFirmware('6.6.0QX')).toEqual([6, 6, 0]);
    expect(parseFirmware('5.0.3-mk3')).toEqual([5, 0, 3]);
    expect(parseFirmware('v9.26.5')).toEqual([9, 26, 5]);
    expect(parseFirmware('desconocido')).toBeNull();
  });

  it('compara con ceros implícitos', () => {
    expect(compareFirmware([1, 0], [1, 0, 0])).toBe(0);
    expect(compareFirmware([1, 0, 38], [1, 0, 37])).toBe(1);
    expect(compareFirmware([4, 1, 9], [4, 2])).toBe(-1);
  });

  it('comparar es antisimétrico', () => {
    const v = fc.array(fc.nat(50), { minLength: 1, maxLength: 4 });
    fc.assert(fc.property(v, v, (a, b) => compareFirmware(a, b) === -compareFirmware(b, a)));
  });
});

describe('advisoriesFor', () => {
  it('Coldcard: el firmware de generación decide', () => {
    expect(ids(advisoriesFor('coldcard-mk4', '5.5.2'))).toEqual(['coldcard-rng-2026']);
    expect(advisoriesFor('coldcard-mk4', '5.6.0')).toEqual([]);
    expect(ids(advisoriesFor('coldcard-mk4', '6.5.0X'))).toEqual(['coldcard-rng-2026']);
    expect(advisoriesFor('coldcard-mk4', '6.6.0X')).toEqual([]);
    expect(ids(advisoriesFor('coldcard-q', '1.4.9Q'))).toEqual(['coldcard-rng-2026']);
    expect(advisoriesFor('coldcard-q', '1.5.0Q')).toEqual([]);
    expect(advisoriesFor('coldcard-mk3', '3.2.2')).toEqual([]);
    expect(ids(advisoriesFor('coldcard-mk3', '4.1.9'))).toEqual(['coldcard-rng-2026']);
    expect(advisoriesFor('coldcard-mk3', '4.2.0')).toEqual([]);
    expect(ids(advisoriesFor('coldcard-mk3', '5.0.3-mk3'))).toEqual(['coldcard-rng-2026']);
  });

  it('firmware desconocido: afectado, pero sin certeza', () => {
    expect(advisoriesFor('coldcard-q')).toEqual([{ advisory: ADVISORIES.find((a) => a.id === 'coldcard-rng-2026'), reason: 'unknown-firmware' }]);
  });

  it('una versión de otro modelo no se da por buena', () => {
    const reasons = (model: string, fw: string) => advisoriesFor(model, fw).map((m) => m.reason);
    expect(reasons('coldcard-q', '5.5.2')).toEqual(['unrecognized-firmware']); // versión de Mk4 en una Q
    expect(reasons('coldcard-q', '5.6.0')).toEqual(['unrecognized-firmware']);
    expect(reasons('coldcard-mk4', '1.5.0Q')).toEqual(['unrecognized-firmware']);
    expect(reasons('coldcard-mk4', 'beta')).toEqual(['unknown-firmware']);
    expect(reasons('coldcard-q', '6.6.0QX')).toEqual([]);
  });

  it('las series de firmware se pueden leer', () => {
    for (const m of HARDWARE_MODELS) for (const l of m.firmwareLines ?? []) {
      expect(compareFirmware(parseFirmware(l.from)!, parseFirmware(l.before)!), m.id).toBeLessThan(0);
    }
  });

  it('sin arreglo por firmware: afecta a cualquier versión, con certeza', () => {
    expect(advisoriesFor('trezor-one', '1.12.1')).toEqual([{ advisory: ADVISORIES.find((a) => a.id === 'trezor-glitch-2020'), reason: 'affected' }]);
  });

  it('modelos sin avisos y la Tapsigner no heredan los de Coldcard', () => {
    expect(advisoriesFor('tapsigner')).toEqual([]);
    expect(advisoriesFor('keystone-3-pro')).toEqual([]);
    expect(advisoriesFor('modelo-inventado')).toEqual([]);
  });

  it('Jade: afectado entre 1.0.24 y 1.0.36', () => {
    expect(advisoriesFor('jade', '1.0.23')).toEqual([]);
    expect(ids(advisoriesFor('jade-plus', '1.0.36'))).toEqual(['jade-register-descriptor-2025']);
    expect(advisoriesFor('jade', '1.0.37')).toEqual([]);
  });
});
