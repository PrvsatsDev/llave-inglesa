import { indexModel, parseModel, type CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { attackText, lossText, secretText } from '../src/index.ts';

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
