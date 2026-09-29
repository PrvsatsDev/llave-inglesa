import { describe, expect, it } from 'vitest';
import { parseModel } from '../src/index.ts';

const valid = {
  format: 'llave-inglesa',
  version: 1,
  name: 'test',
  keys: [{ id: 'k1', label: 'K1' }],
  policy: { type: 'key', key: 'k1' },
  people: [{ id: 'yo', name: 'Yo', role: 'owner' }],
  locations: [{ id: 'casa', name: 'Casa', access: [{ person: 'yo' }] }],
};

const codes = (input: unknown) => {
  const r = parseModel(input);
  return r.ok ? r.warnings.map((w) => w.code) : r.issues.map((i) => i.code);
};

describe('parseModel', () => {
  it('acepta un modelo mínimo y aplica valores por defecto', () => {
    const r = parseModel(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.model.keys[0]!.passphrase).toBe(false);
    expect(r.model.keys[0]!.provenance.sources).toEqual([{ kind: 'unknown' }]);
    expect(r.model.locations[0]!.access[0]!.when).toEqual({ type: 'always' });
  });

  it('rechaza ids duplicados entre colecciones', () => {
    expect(codes({ ...valid, locations: [{ id: 'k1', name: 'X' }] })).toContain('duplicate-id');
  });

  it('rechaza referencias inexistentes', () => {
    expect(codes({ ...valid, policy: { type: 'key', key: 'nope' } })).toContain('unknown-reference');
  });

  it('rechaza umbrales imposibles', () => {
    expect(codes({ ...valid, policy: { type: 'thresh', k: 2, of: [{ type: 'key', key: 'k1' }] } })).toContain('threshold-out-of-range');
  });

  it('rechaza un stateless con keys dentro', () => {
    const devices = [{ id: 'ss', label: 'SS', vendor: 'SeedSigner', kind: 'stateless', holds: ['k1'], location: 'casa' }];
    expect(codes({ ...valid, devices })).toContain('stateless-holds-keys');
  });

  it('exige un titular', () => {
    expect(codes({ ...valid, people: [{ id: 'yo', name: 'Yo', role: 'heir' }] })).toContain('no-owner');
  });

  it('avisa (sin bloquear) de una passphrase en una key sin passphrase', () => {
    const r = parseModel({ ...valid, people: [{ id: 'yo', name: 'Yo', role: 'owner', knows: [{ type: 'passphrase', key: 'k1' }] }] });
    expect(r.ok).toBe(true);
    expect(codes({ ...valid, people: [{ id: 'yo', name: 'Yo', role: 'owner', knows: [{ type: 'passphrase', key: 'k1' }] }] })).toEqual(['passphrase-not-enabled']);
  });
});
