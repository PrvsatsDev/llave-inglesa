import { ADVISORIES, advisoriesFor, indexModel, parseModel, type CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { ADVISORY_TITLE, advisoryText, attackText, lossText, secretText } from '../src/index.ts';

const result = parseModel({
  format: 'llave-inglesa',
  version: 1,
  name: 'test',
  keys: [{ id: 'k1', label: 'K1' }],
  policy: { type: 'key', key: 'k1' },
  artifacts: [{ id: 'desc', label: 'Descriptor', medium: 'digital', contents: [{ type: 'descriptor' }], location: 'nube' }],
  people: [{ id: 'yo', name: 'Yo', role: 'owner' }],
  locations: [
    { id: 'casa', name: 'Casa' },
    { id: 'portatil', name: 'Portátil', kind: 'device' },
    { id: 'nube', name: 'iCloud', kind: 'cloud' },
  ],
});
if (!result.ok) throw new Error('modelo de test inválido');
const index = indexModel(result.model as CustodyModel);

describe('textos según el tipo de ubicación', () => {
  it('ataques', () => {
    expect(attackText({ type: 'burglary', location: 'casa' }, index)).toBe('Intrusión en Casa');
    expect(attackText({ type: 'burglary', location: 'portatil' }, index)).toBe('Robo o malware en Portátil');
    expect(attackText({ type: 'burglary', location: 'nube' }, index)).toBe('Hackeo de iCloud');
  });

  it('pérdidas', () => {
    expect(lossText({ type: 'destroy-location', location: 'casa' }, index)).toBe('Destrucción de Casa');
    expect(lossText({ type: 'destroy-location', location: 'portatil' }, index)).toBe('Avería o robo de Portátil');
    expect(lossText({ type: 'destroy-location', location: 'nube' }, index)).toBe('Pérdida de la cuenta iCloud');
  });

  it('contraseñas', () => {
    expect(secretText({ type: 'password', artifact: 'desc' }, index.label)).toBe('contraseña de Descriptor');
  });
});

describe('avisos del catálogo', () => {
  it('todos los avisos tienen título', () => {
    for (const a of ADVISORIES) expect(ADVISORY_TITLE[a.id], a.id).toBeDefined();
  });

  it('Coldcard sin firmware: afectado por defecto, explotado y con mitigaciones', () => {
    const t = advisoryText(advisoriesFor('coldcard-q')[0]!);
    expect(t.title).toContain('Coldcard');
    expect(t.detail).toContain('Ya se ha explotado');
    expect(t.detail).toContain('Sin saber la versión');
    expect(t.detail).toContain('1.5.0');
    expect(t.mitigations).toBe('Mitiga: mezclar al menos 128 bits de entropía propia (unas 50 tiradas de dado) o passphrase.');
  });

  it('versión de otro modelo', () => {
    expect(advisoryText(advisoriesFor('coldcard-q', '5.5.2')[0]!).detail).toContain('No reconocemos esa versión');
  });

  it('sin arreglo por firmware', () => {
    const t = advisoryText(advisoriesFor('trezor-one', '1.12.1')[0]!);
    expect(t.detail).toContain('No se puede corregir por firmware.');
    expect(t.detail).not.toContain('Sin saber la versión');
  });
});

describe('ataques de entropía: hipotético frente a conocido', () => {
  it('distingue el fallo aún desconocido del publicado', () => {
    expect(attackText({ type: 'entropy-compromise', origin: { kind: 'vendor', vendor: 'SeedSigner' } }, index)).toBe('RNG con fallo aún desconocido: SeedSigner');
    expect(attackText({ type: 'known-weak-entropy', advisory: 'coldcard-rng-2026' }, index)).toBe('Semilla adivinable por un fallo publicado: Coldcard 2026');
  });
});
