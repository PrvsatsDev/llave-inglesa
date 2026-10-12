import type { Computer, CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, attackAtoms, compromisedDevices, COMPUTER_MALWARE_EFFORT, createWorld, DAILY_COMPUTER_PENALTY, inheritanceLetter, type AttackAtom, lossAtoms, securityBreakdown, securityScore, simulateAttack } from '../src/index.ts';
import { base, loadFixture, parse } from './helpers.ts';

const descriptor = { kind: 'secret', secret: { type: 'descriptor' } } as const;

/** R09 (2 de 3 repartido) sin ninguna copia impresa del descriptor, con estos ordenadores. */
function r09(...computers: Computer[]): CustodyModel {
  const model = loadFixture('referencia/r09-2de3-distribuido');
  return { ...model, artifacts: model.artifacts.filter((a) => !a.contents.some((c) => c.type === 'descriptor')), computers };
}
const laptop: Computer = { id: 'portatil', label: 'Portátil', use: 'daily', wallet: true, location: 'casa' };
const phone: Computer = { id: 'movil', label: 'Móvil', use: 'daily', wallet: true, carriedBy: 'yo' };

describe('ordenador de firma: guarda el descriptor', () => {
  it('quien entra en casa se lleva el descriptor de la cartera del portátil', () => {
    expect(simulateAttack(r09(), [{ type: 'burglary', location: 'casa' }]).has(descriptor)).toBe(false);
    const d = simulateAttack(r09(laptop), [{ type: 'burglary', location: 'casa' }]);
    expect(d.has(descriptor)).toBe(true);
    expect(d.facts.get('secret:descriptor')!.justification).toMatchObject({ rule: 'computer-wallet', via: { item: 'portatil' } });
  });

  it('sin la cartera guardada, no hay descriptor que llevarse', () => {
    expect(simulateAttack(r09({ ...laptop, wallet: false }), [{ type: 'burglary', location: 'casa' }]).has(descriptor)).toBe(false);
  });

  it('el móvil no está en casa: va con quien lo lleva, y se consigue coaccionándola', () => {
    expect(simulateAttack(r09(phone), [{ type: 'burglary', location: 'casa' }]).has(descriptor)).toBe(false);
    const d = simulateAttack(r09(phone), [{ type: 'coercion', person: 'yo', location: null }]);
    expect(d.has(descriptor)).toBe(true);
    expect(d.facts.get('item:movil')!.justification).toMatchObject({ rule: 'carried', via: { person: 'yo' } });
  });

  it('quitar los descriptores impresos ya no sube la seguridad si la cartera está en un ordenador de casa', () => {
    const printed = analyze(loadFixture('referencia/r09-2de3-distribuido')).security;
    const none = analyze(r09()).security;
    const dedicated = analyze(r09({ ...laptop, use: 'dedicated' })).security;
    expect(none.minEffort).toBeGreaterThanOrEqual(printed.minEffort!);
    expect(none.score).toBeGreaterThan(printed.score);
    expect(dedicated.score).toBe(printed.score);
  });
});

describe('ordenador de firma: resta en seguridad', () => {
  it('uno de uso diario resta 2; uno dedicado, nada', () => {
    const daily = analyze(r09(laptop)).security;
    const dedicated = analyze(r09({ ...laptop, use: 'dedicated' })).security;
    expect(daily.dailyComputer).toBe(true);
    expect(dedicated.dailyComputer).toBe(false);
    expect(daily.score).toBe(securityScore(daily.minEffort, daily.cheapRoutes) - DAILY_COMPUTER_PENALTY);
    expect(dedicated.score).toBe(securityScore(dedicated.minEffort, dedicated.cheapRoutes));
  });

  it('el desglose lo enseña como una resta más, también sin ningún robo', () => {
    expect(securityBreakdown(null, 0, true)).toEqual({ base: 100, penalties: [{ reason: 'daily-computer', points: 2 }], score: 98 });
    expect(securityBreakdown(2, 3, true).penalties).toEqual([
      { reason: 'exposure', points: 4 },
      { reason: 'daily-computer', points: 2 },
    ]);
  });
});

describe('ordenador de firma: copia poco fiable', () => {
  it('se estropea, y un incendio en casa se lo lleva; el móvil no se quema con la casa', () => {
    const model = r09(laptop, phone);
    expect(lossAtoms(createWorld(model))).toContainEqual({ type: 'item-loss', item: 'portatil' });
    expect(lossAtoms(createWorld(model))).toContainEqual({ type: 'item-loss', item: 'movil' });
    const fire = createWorld(model, [{ type: 'destroy-location', location: 'casa', disaster: 'fire' }]);
    expect(fire.lostItems.has('portatil')).toBe(true);
    expect(fire.lostItems.has('movil')).toBe(false);
  });

  it('no quita el aviso grave ni la resta de multisig sin descriptor: un backup sigue haciendo falta', () => {
    expect(analyze(r09(laptop)).resilience.noDescriptorCopy).toBe(true);
  });

  it('los herederos leen la cartera del portátil de casa, pero no la del móvil de quien ha fallecido', () => {
    expect(analyze(r09()).inheritance.rebuild).toBe(true);
    expect(analyze(r09(laptop)).inheritance.rebuild).toBe(false);
    expect(analyze(r09(phone)).inheritance.rebuild).toBe(true);
  });
});

describe('ordenador de firma: carta de herencia', () => {
  it('si los herederos usan la cartera del portátil, la carta les manda a por él', () => {
    const model = r09(laptop);
    const letter = inheritanceLetter(model, analyze(model).inheritance);
    const pieces = letter.stops.flatMap((s) => s.pieces);
    expect(letter.usesDescriptor).toBe(true);
    expect(pieces).toContainEqual(expect.objectContaining({ item: 'portatil', kind: 'computer', needed: true, provides: [{ type: 'descriptor' }] }));
  });
});

/** Single-sig con un BitBox02 de firmware afectado (fallo explotable desde el ordenador) y estos ordenadores. */
function bitbox(firmware: string, ...computers: Computer[]): CustodyModel {
  return parse(base({
    keys: [{ id: 'k1', label: 'K1' }],
    policy: { type: 'key', key: 'k1' },
    devices: [{ id: 'bb', label: 'BitBox', vendor: 'BitBox', model: 'BitBox02', firmware, kind: 'stateful', holds: ['k1'], pinProtected: true, location: 'casa' }],
    people: [{ id: 'yo', name: 'Yo', role: 'owner', knows: [{ type: 'pin', device: 'bb' }] }],
    computers,
  }));
}
const pc: Computer = { id: 'pc', label: 'Portátil', use: 'daily', wallet: false, location: 'casa' };
const malware = (computer = 'pc'): AttackAtom => ({ type: 'computer-malware', computer });

describe('ordenador de firma: malware', () => {
  it('explota el fallo del dispositivo conectado y da su semilla: con uno de uso general, robo de esfuerzo 1', () => {
    const model = bitbox('9.20.0', pc);
    const d = simulateAttack(model, [malware()]);
    expect(d.canSpend).toBe(true);
    expect(d.facts.get('secret:seed:k1')!.justification).toMatchObject({ rule: 'host-exploit', via: { device: 'bb', item: 'pc', advisory: 'bitbox02-2026-08' } });
    expect(analyze(model).security.minEffort).toBe(COMPUTER_MALWARE_EFFORT.daily);
    expect(compromisedDevices(createWorld(model), [malware()])).toEqual(new Map([['pc', 'malware'], ['bb', 'host']]));
  });

  it('dedicado cuesta 3', () => {
    expect(analyze(bitbox('9.20.0', { ...pc, use: 'dedicated' })).security.minEffort).toBe(COMPUTER_MALWARE_EFFORT.dedicated);
  });

  it('con el firmware corregido, o si el dispositivo no se le conecta, no hay nada que explotar', () => {
    expect(attackAtoms(createWorld(bitbox('9.26.5', pc))).some((a) => a.type === 'computer-malware')).toBe(false);
    expect(attackAtoms(createWorld(bitbox('9.20.0', { ...pc, connects: [] }))).some((a) => a.type === 'computer-malware')).toBe(false);
    expect(simulateAttack(bitbox('9.20.0', { ...pc, connects: ['bb'] }), [malware()]).canSpend).toBe(true);
  });

  it('lee el descriptor de la cartera, sin tener el ordenador en la mano', () => {
    const d = simulateAttack(r09({ ...laptop, location: undefined, carriedBy: 'yo' }), [malware('portatil')]);
    expect(d.facts.get('secret:descriptor')!.justification).toMatchObject({ rule: 'computer-malware', via: { item: 'portatil' } });
    expect(d.has({ kind: 'item', item: 'portatil' })).toBe(false);
  });
});
