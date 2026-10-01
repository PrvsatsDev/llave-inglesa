import { describe, expect, it } from 'vitest';
import { analyze, explain, simulateInheritance } from '../src/index.ts';
import { base, loadFixture, parse } from './helpers.ts';

const plate = (key: string, location: string) => ({
  id: `metal-${key}`, label: `Metal ${key}`, medium: 'metal' as const, contents: [{ type: 'seed' as const, key }], location,
});

// 2 de 2: K1 en casa (la pareja entra tras fallecer Yo), K2 en el banco (solo entra el hermano, custodio).
const shared = parse(
  base({
    people: [
      { id: 'yo', name: 'Yo', role: 'owner' },
      { id: 'pareja', name: 'Pareja', role: 'heir' },
      { id: 'hermano', name: 'Hermano', role: 'custodian' },
    ],
    locations: [
      { id: 'casa', name: 'Casa', access: [{ person: 'yo' }, { person: 'pareja', when: { type: 'after-death', person: 'yo' } }] },
      { id: 'banco', name: 'Banco', access: [{ person: 'yo' }, { person: 'hermano' }] },
    ],
    artifacts: [plate('k1', 'casa'), plate('k2', 'banco')],
  }),
);

describe('herencia: herederos y quién les ayuda', () => {
  it('si los herederos se bastan, no se nombra a nadie más (el hermano del ejemplo no hace falta)', () => {
    const inh = analyze(loadFixture('distribuido-2de3')).inheritance;
    expect(inh.heirs).toEqual(['pareja']);
    expect(inh.helpers).toEqual([]);
  });

  it('un custodio imprescindible aparece como ayuda, no como heredero', () => {
    const inh = analyze(shared).inheritance;
    expect(inh).toMatchObject({ status: 'ok', heirs: ['pareja'], helpers: ['hermano'] });
    expect(inh.locations?.sort()).toEqual(['banco', 'casa']);
    expect(simulateInheritance(shared, inh.locations!, [...inh.heirs, ...inh.helpers]).canSpend).toBe(true);
    expect(simulateInheritance(shared, inh.locations!, inh.heirs).canSpend).toBe(false);
  });

  it('sin nadie con papel de heredero, un custodio puede bastar', () => {
    const noHeir = parse({ ...shared, people: shared.people.map((p) => (p.id === 'pareja' ? { ...p, role: 'other' } : p)), artifacts: [plate('k1', 'banco'), plate('k2', 'banco')] });
    const inh = analyze(noHeir).inheritance;
    expect(inh).toMatchObject({ status: 'ok', heirs: [], helpers: ['hermano'], locations: ['banco'] });
    expect(explain(simulateInheritance(noHeir, inh.locations!, inh.helpers), 'spend')).not.toBeNull();
  });
});
