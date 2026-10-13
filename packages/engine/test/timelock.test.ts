import { BLOCKS_PER_DAY, type CustodyModel, type Policy } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import {
  analyze,
  attackAtoms,
  createWorld,
  explain,
  inheritanceLetter,
  keyWait,
  EVENTUALLY,
  RENEWAL_PENALTY,
  satisfy,
  simulateAttack,
  simulateInheritance,
  simulateLosses,
  TIMELOCK_WAIT_EFFORT,
} from '../src/index.ts';
import { loadFixture } from './helpers.ts';

const key = (k: string): Policy => ({ type: 'key', key: k });
const older = (days: number): Policy => ({ type: 'older', blocks: days * BLOCKS_PER_DAY });
const SEIS_MESES = 180 * BLOCKS_PER_DAY;
const UN_ANO = 365 * BLOCKS_PER_DAY;

describe('satisfy con timelocks', () => {
  const recovery: Policy = { type: 'thresh', k: 1, of: [key('k1'), { type: 'thresh', k: 2, of: [key('k2'), older(180)] }] };

  it('una rama con espera solo se cumple cuando ha pasado el tiempo', () => {
    expect(satisfy(recovery, new Set(['k2']))).toBeNull();
    expect(satisfy(recovery, new Set(['k2']), SEIS_MESES - 1)).toBeNull();
    expect(satisfy(recovery, new Set(['k2']), SEIS_MESES)).toEqual({ keys: ['k2'], wait: SEIS_MESES });
    expect(satisfy(recovery, new Set(['k2']), EVENTUALLY)).toEqual({ keys: ['k2'], wait: SEIS_MESES });
  });

  it('pudiendo gastar ya, no espera', () => {
    expect(satisfy(recovery, new Set(['k1', 'k2']), EVENTUALLY)).toEqual({ keys: ['k1'], wait: 0 });
  });

  it('2 de 3 que se relaja: una key y el timelock cuentan como dos', () => {
    const decaying: Policy = { type: 'thresh', k: 2, of: [key('a'), key('b'), key('c'), older(365)] };
    expect(satisfy(decaying, new Set(['a']))).toBeNull();
    expect(satisfy(decaying, new Set(['a']), EVENTUALLY)).toEqual({ keys: ['a'], wait: UN_ANO });
    expect(satisfy(decaying, new Set(['a', 'b']), EVENTUALLY)).toEqual({ keys: ['a', 'b'], wait: 0 });
  });
});

describe('R13: key de recuperación de la heredera', () => {
  const model = loadFixture('referencia/r13-recuperacion-heredera');
  const a = analyze(model);

  it('perder la key del titular no lo pierde: se recupera esperando 6 meses', () => {
    const lose: Parameters<typeof simulateLosses>[1] = [{ type: 'item-loss', item: 'nuevo-dispositivo' }, { type: 'item-loss', item: 'nuevo-backup-2' }];
    expect(simulateLosses(model, lose).canSpend).toBe(false);
    const waited = simulateLosses(model, lose, EVENTUALLY);
    expect(waited.canSpend).toBe(true);
    expect(waited.wait).toBe(SEIS_MESES);
    expect(a.resilience.delays).toContainEqual(lose);
    expect(a.resilience.cuts).not.toContainEqual(lose);
    const i = a.resilience.delays.findIndex((d) => JSON.stringify(d) === JSON.stringify(lose));
    expect(a.resilience.delayWaits[i]).toBe(SEIS_MESES);
  });

  it('la incapacidad del titular ya no bloquea hasta el fallecimiento: es un retraso', () => {
    expect(a.resilience.delays).toContainEqual([{ type: 'incapacity', person: 'yo' }]);
    expect(a.resilience.lockouts).not.toContainEqual([{ type: 'incapacity', person: 'yo' }]);
  });

  it('la heredera hereda sin esperar si llega a la key del titular (entra en casa tras su fallecimiento)', () => {
    expect(a.inheritance.status).toBe('ok');
    expect(a.inheritance.wait).toBe(0);
  });

  it('si solo tiene su key, la recupera tras esperar, y la explicación lo cuenta', () => {
    const own: CustodyModel = {
      ...model,
      locations: model.locations.map((l) => ({ ...l, access: l.access.filter((x) => x.person === 'yo' || l.id === 'nueva-ubicacion-2') })),
    };
    const b = analyze(own);
    expect(b.inheritance.status).toBe('ok');
    expect(b.inheritance.locations).toEqual(['nueva-ubicacion-2']);
    expect(b.inheritance.wait).toBe(SEIS_MESES);
    const tree = explain(simulateInheritance(own, b.inheritance.locations!, b.inheritance.heirs), 'spend');
    expect(tree?.children.map((c) => c.id)).toContain(`timelock:${SEIS_MESES}`);
  });

  it('robarle a la heredera exige esperar sin que el titular renueve: caro, porque renueva cada 3 meses', () => {
    expect(attackAtoms(createWorld(model))).toContainEqual({ type: 'timelock-wait', blocks: SEIS_MESES });
    const route = [{ type: 'burglary' as const, location: 'nueva-ubicacion-2' }, { type: 'timelock-wait' as const, blocks: SEIS_MESES }];
    const i = a.security.cuts.findIndex((c) => JSON.stringify(c) === JSON.stringify(route));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(a.security.efforts[i]).toBe(1.5 + TIMELOCK_WAIT_EFFORT.renewed);
    expect(simulateAttack(model, route).canSpend).toBe(true);
    expect(simulateAttack(model, route.slice(0, 1)).canSpend).toBe(false);
  });

  it('sin renovar a tiempo (o sin indicarlo), esperar es barato', () => {
    for (const renewal of [undefined, { everyDays: 365 }]) {
      const lax: CustodyModel = { ...model, renewal };
      const b = analyze(lax);
      const i = b.security.cuts.findIndex((c) => c.some((x) => x.type === 'timelock-wait') && c.some((x) => x.type === 'burglary' && x.location === 'nueva-ubicacion-2'));
      expect(b.security.efforts[i]).toBe(1.5 + TIMELOCK_WAIT_EFFORT.lapsed);
    }
  });

  it('renovar cuesta usabilidad', () => {
    expect(a.usability.renewal).toBe(true);
    expect(a.usability.score).toBe(100 - RENEWAL_PENALTY);
  });
});

describe('cuánto tiene que esperar cada key para servir', () => {
  it('sale del árbol: 0 si sirve sin esperar, la espera de su rama si no', () => {
    const r13 = loadFixture('referencia/r13-recuperacion-heredera').policy;
    const r14 = loadFixture('referencia/r14-2de3-se-relaja').policy;
    const r15 = loadFixture('referencia/r15-2de3-se-amplia').policy;
    expect([keyWait(r13, 'k1'), keyWait(r13, 'k2'), keyWait(r13, 'k9')]).toEqual([0, SEIS_MESES, null]);
    expect(keyWait(r14, 'k1')).toBe(0);
    expect([keyWait(r15, 'k1'), keyWait(r15, 'k4')]).toEqual([0, UN_ANO]);
  });

  it('la carta de R13 dice que la placa de la heredera solo sirve tras esperar', () => {
    const model = loadFixture('referencia/r13-recuperacion-heredera');
    const pieces = inheritanceLetter(model, analyze(model).inheritance).stops.flatMap((s) => s.pieces);
    expect(pieces.find((p) => p.item === 'nuevo-backup-4')).toMatchObject({ needed: false, wait: SEIS_MESES });
    expect(pieces.find((p) => p.item === 'nuevo-backup-2')).toMatchObject({ needed: true, wait: 0 });
  });
});

describe('varios timelocks', () => {
  it('esperar al más largo es la misma vía con más espera: solo cuenta el corto', () => {
    const base = loadFixture('referencia/r13-recuperacion-heredera');
    // La heredera puede firmar sola a los 6 meses; con un año, otra rama que también usa su key.
    const model: CustodyModel = {
      ...base,
      policy: { type: 'thresh', k: 1, of: [key('k1'), { type: 'thresh', k: 2, of: [key('k2'), older(180)] }, { type: 'thresh', k: 2, of: [key('k2'), older(365)] }] },
    };
    const waits = analyze(model).security.cuts.flatMap((c) => c.filter((x) => x.type === 'timelock-wait'));
    expect(waits.length).toBeGreaterThan(0);
    expect(waits.every((w) => w.type === 'timelock-wait' && w.blocks === SEIS_MESES)).toBe(true);
  });
});

describe('2 de 3 que se relaja y que se amplía', () => {
  const r09 = analyze(loadFixture('referencia/r09-2de3-distribuido'));
  const r14 = analyze(loadFixture('referencia/r14-2de3-se-relaja'));
  const r15 = analyze(loadFixture('referencia/r15-2de3-se-amplia'));

  it('la incapacidad del titular, que en R09 bloquea, pasa a ser un retraso de un año', () => {
    expect(r09.resilience.lockouts).toContainEqual([{ type: 'incapacity', person: 'yo' }]);
    for (const r of [r14, r15]) {
      expect(r.resilience.lockouts).not.toContainEqual([{ type: 'incapacity', person: 'yo' }]);
      expect(r.resilience.delays).toContainEqual([{ type: 'incapacity', person: 'yo' }]);
    }
  });

  it('son más resilientes que R09 y no menos seguros', () => {
    for (const r of [r14, r15]) {
      expect(r.resilience.score).toBeGreaterThan(r09.resilience.score);
      expect(r.security.score).toBe(r09.security.score);
    }
  });

  it('herencia de R14: esperar un año con una key (1 visita) puntúa; ir también al banco, sin esperar, queda como alternativa', () => {
    expect(r14.inheritance.wait).toBe(UN_ANO);
    expect(r14.inheritance.visits).toBe(1);
    expect(r14.inheritance.withoutWait).toEqual({ locations: ['casa', 'nueva-ubicacion', 'nueva-ubicacion-2'], visits: 2 });
    expect(r09.inheritance.withoutWait).toBeNull();
  });

  it('la carta de R14 dice cuánto esperar y qué reunir para no esperar', () => {
    const model = loadFixture('referencia/r14-2de3-se-relaja');
    const letter = inheritanceLetter(model, r14.inheritance);
    expect(letter.wait).toBe(UN_ANO);
    expect(letter.withoutWait?.map((s) => s.location)).toEqual(['casa', 'nueva-ubicacion', 'nueva-ubicacion-2']);
    const items = letter.withoutWait!.flatMap((s) => s.pieces.map((p) => p.item));
    expect(items).toContain('nuevo-backup-3'); // la placa K2 del banco
    expect(inheritanceLetter(loadFixture('referencia/r09-2de3-distribuido'), r09.inheritance)).toMatchObject({ wait: 0, withoutWait: null });
  });

  it('la carta de R15 lista la key del abogado (la pareja entra en el despacho tras el fallecimiento) y que solo sirve tras un año', () => {
    const model = loadFixture('referencia/r15-2de3-se-amplia');
    const despacho = inheritanceLetter(model, r15.inheritance).stops.find((s) => s.location === 'nueva-ubicacion-4');
    expect(despacho?.pieces.find((p) => p.item === 'nuevo-backup-8')).toMatchObject({ needed: false, wait: UN_ANO });
  });

  it('en el que se amplía, la key del abogado sola no basta ni esperando', () => {
    const model = loadFixture('referencia/r15-2de3-se-amplia');
    expect(simulateAttack(model, [{ type: 'insider', person: 'nueva-persona-2' }, { type: 'timelock-wait', blocks: UN_ANO }]).canSpend).toBe(false);
  });
});
