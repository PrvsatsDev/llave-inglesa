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

  it('exige un titular', () => {
    expect(codes({ ...valid, people: [{ id: 'yo', name: 'Yo', role: 'heir' }] })).toContain('no-owner');
  });

  it('acepta sin avisos las referencias latentes (desactivadas)', () => {
    const devices = [
      { id: 'ss', label: 'SS', vendor: 'SeedSigner', kind: 'stateless', holds: ['k1'], location: 'casa' },
      { id: 'cc', label: 'CC', vendor: 'Coinkite', kind: 'stateful', holds: ['k1'], pinProtected: false, location: 'casa' },
    ];
    const people = [{ id: 'yo', name: 'Yo', role: 'owner', knows: [{ type: 'passphrase', key: 'k1' }, { type: 'pin', device: 'cc' }] }];
    expect(codes({ ...valid, devices, people })).toEqual([]);
  });
});

describe('aviso: PIN que nadie sabe', () => {
  const withDevice = (people: unknown[], artifacts: unknown[] = []) => ({
    ...valid,
    devices: [{ id: 'hw', label: 'HW', vendor: 'X', kind: 'stateful', holds: ['k1'], pinProtected: true, location: 'casa' }],
    people,
    artifacts,
  });

  it('avisa si el dispositivo tiene PIN y nadie lo sabe ni está apuntado', () => {
    expect(codes(withDevice([{ id: 'yo', name: 'Yo', role: 'owner' }]))).toContain('pin-unknown');
  });

  it('no avisa si alguien lo sabe o está apuntado en un backup', () => {
    expect(codes(withDevice([{ id: 'yo', name: 'Yo', role: 'owner', knows: [{ type: 'pin', device: 'hw' }] }]))).not.toContain('pin-unknown');
    const note = { id: 'nota', label: 'Nota', medium: 'paper', contents: [{ type: 'pin', device: 'hw' }], location: 'casa' };
    expect(codes(withDevice([{ id: 'yo', name: 'Yo', role: 'owner' }], [note]))).not.toContain('pin-unknown');
  });

  it('sin PIN no hay nada que saber', () => {
    const m = withDevice([{ id: 'yo', name: 'Yo', role: 'owner' }]);
    expect(codes({ ...m, devices: [{ ...m.devices[0], pinProtected: false }] })).not.toContain('pin-unknown');
  });
});
