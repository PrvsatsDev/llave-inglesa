import { readFileSync } from 'node:fs';
import { parseModel, type CustodyModel, type CustodyModelInput } from '@llave-inglesa/domain';

export function loadFixture(name: string): CustodyModel {
  const url = new URL(`../../../fixtures/${name}.json`, import.meta.url);
  return parse(JSON.parse(readFileSync(url, 'utf8')));
}

export function parse(input: CustodyModelInput | unknown): CustodyModel {
  const result = parseModel(input);
  if (!result.ok) throw new Error(`Modelo inválido: ${JSON.stringify(result.issues)}`);
  return result.model;
}

/** Modelo mínimo para tests de reglas: 2 de 2 con K1, K2 en una sola ubicación. */
export function base(overrides: Partial<CustodyModelInput> = {}): CustodyModelInput {
  return {
    format: 'llave-inglesa',
    version: 1,
    name: 'test',
    keys: [
      { id: 'k1', label: 'K1' },
      { id: 'k2', label: 'K2' },
    ],
    policy: { type: 'thresh', k: 2, of: [{ type: 'key', key: 'k1' }, { type: 'key', key: 'k2' }] },
    people: [{ id: 'yo', name: 'Yo', role: 'owner' }],
    locations: [{ id: 'casa', name: 'Casa', access: [{ person: 'yo' }] }],
    ...overrides,
  };
}
