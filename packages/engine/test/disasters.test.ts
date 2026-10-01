import { describe, expect, it } from 'vitest';
import { createWorld, itemsAvailableAt, lossAtoms, simulateLosses, type LossEvent } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

// Casa: Coldcard Q (K1), placa de metal K2, SeedSigner y descriptor en papel. Banco: metal K1 + descriptor en papel.
const casa = loadFixture('todo-en-casa');
const at = (events: LossEvent[], location: string) =>
  itemsAvailableAt(createWorld(casa, events), location).map((i) => i.value.id).sort();

describe('desastres y soportes', () => {
  it('cada tipo de ubicación tiene sus desastres', () => {
    const portatil = { ...casa, locations: [...casa.locations, { id: 'portatil', name: 'Portátil', kind: 'device' as const, access: [] }] };
    const disasters = lossAtoms(createWorld(portatil)).flatMap((e) => (e.type === 'destroy-location' ? [`${e.location}:${e.disaster}`] : []));
    expect(disasters.filter((d) => d.startsWith('casa:'))).toEqual(['casa:fire', 'casa:flood', 'casa:total']);
    expect(disasters.filter((d) => d.startsWith('portatil:'))).toEqual(['portatil:total']);
  });

  it('un incendio o una inundación solo dejan lo que es de acero', () => {
    for (const disaster of ['fire', 'flood'] as const) {
      expect(at([{ type: 'destroy-location', location: 'casa', disaster }], 'casa')).toEqual(['metal-k2']);
    }
  });

  it('la pérdida del acceso se lo lleva todo', () => {
    expect(at([{ type: 'destroy-location', location: 'casa', disaster: 'total' }], 'casa')).toEqual([]);
  });

  it('un incendio en casa no impide recuperar: la placa de K2 sobrevive', () => {
    expect(simulateLosses(casa, [{ type: 'destroy-location', location: 'casa', disaster: 'fire' }]).canSpend).toBe(true);
  });

  it('si la K2 estuviera en papel, el incendio + perder la caja del banco sí lo pierde todo', () => {
    const paper = { ...casa, artifacts: casa.artifacts.map((a) => (a.id === 'metal-k2' ? { ...a, medium: 'paper' as const } : a)) };
    const fire: LossEvent[] = [{ type: 'destroy-location', location: 'casa', disaster: 'fire' }, { type: 'destroy-location', location: 'banco', disaster: 'total' }];
    expect(simulateLosses(casa, fire).canSpend).toBe(true);
    expect(simulateLosses(paper, fire).canSpend).toBe(false);
  });
});
