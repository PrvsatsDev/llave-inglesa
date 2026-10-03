import { indexModel, removeArtifact, updateDevice } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, ATTACK_EFFORT, attackEffort, DURESS_SURCHARGE, type AttackAtom } from '../src/index.ts';
import { loadFixture } from './helpers.ts';

const casa = loadFixture('todo-en-casa'); // la llave inglesa en casa es la vía más barata (esfuerzo 3)
const duress = updateDevice(casa, 'ccq', { duressPin: true });
const index = indexModel(duress);
const wrench: AttackAtom[] = [{ type: 'coercion', person: 'yo', location: 'casa' }];

const routeOf = (m: typeof casa, cut: AttackAtom[]) => {
  const s = analyze(m).security;
  const i = s.cuts.findIndex((c) => JSON.stringify(c) === JSON.stringify(cut));
  return i < 0 ? null : { effort: s.efforts[i], beatsDuress: s.beatsDuress[i] };
};

describe('PIN de coacción', () => {
  it('encarece la llave inglesa que depende de ese PIN, sin anularla', () => {
    expect(routeOf(casa, wrench)).toEqual({ effort: ATTACK_EFFORT.coercion, beatsDuress: false });
    expect(routeOf(duress, wrench)).toEqual({ effort: ATTACK_EFFORT.coercion + DURESS_SURCHARGE, beatsDuress: true });
  });

  it('sube la seguridad', () => {
    expect(analyze(duress).security.score).toBeGreaterThan(analyze(casa).security.score);
  });

  it('sin PIN activado no cuenta (desactivar conserva: vuelve al reactivarlo)', () => {
    const noPin = updateDevice(duress, 'ccq', { pinProtected: false });
    expect(analyze(noPin).security.beatsDuress.every((b) => !b)).toBe(true);
    expect(analyze(updateDevice(noPin, 'ccq', { pinProtected: true }))).toEqual(analyze(duress));
  });

  it('si el PIN está además apuntado a mano en casa, el falso no sirve de nada', () => {
    const withPaper = {
      ...duress,
      artifacts: [...duress.artifacts, { id: 'pin-papel', label: 'PIN apuntado', medium: 'paper' as const, contents: [{ type: 'pin' as const, device: 'ccq' }], lockedBy: [], location: 'casa' }],
    };
    expect(routeOf(withPaper, wrench)?.beatsDuress).toBe(false);
  });

  it('no afecta a robos sin coacción (quien traiciona da el PIN bueno)', () => {
    const s = analyze(duress).security;
    s.cuts.forEach((cut, i) => {
      if (cut.every((a) => a.type !== 'coercion')) expect(s.efforts[i]).toBe(attackEffort(cut, index));
    });
  });
});

describe('informe del PIN de coacción: ¿ayuda?', () => {
  const r06 = loadFixture('referencia/r06-passphrase-solo-memoria');
  const trezor = 'nuevo-dispositivo';
  const withDuress = updateDevice(r06, trezor, { duressPin: true });

  it('solo informa de los dispositivos con PIN y PIN de coacción', () => {
    expect(analyze(r06).duress).toEqual([]);
    expect(analyze(updateDevice(withDuress, trezor, { pinProtected: false })).duress).toEqual([]);
  });

  it('no ayuda si la llave inglesa también da la placa: dice por qué vía y con qué objetos', () => {
    const [report] = analyze(withDuress).duress;
    expect(report).toEqual({
      device: trezor,
      helps: false,
      minEffortWithout: analyze(r06).security.minEffort,
      scoreWithout: analyze(r06).security.score,
      bypass: [{ type: 'coercion', person: 'yo', location: 'casa' }],
      bypassItems: ['nuevo-backup'],
    });
  });

  it('ayuda si el dispositivo es la única vía: compara con el esquema sin él', () => {
    const onlyDevice = removeArtifact(withDuress, 'nuevo-backup');
    const a = analyze(onlyDevice);
    const [report] = a.duress;
    expect(report!.helps).toBe(true);
    expect(report!.bypass).toBeNull();
    expect(report!.minEffortWithout).toBe(a.security.minEffort! - DURESS_SURCHARGE);
    expect(report!.scoreWithout).toBe(analyze(updateDevice(onlyDevice, trezor, { duressPin: false })).security.score);
    expect(report!.scoreWithout).toBeLessThan(a.security.score);
  });

  it('en Todo en casa ayuda: la llave inglesa necesita el Coldcard', () => {
    expect(analyze(duress).duress).toMatchObject([{ device: 'ccq', helps: true }]);
  });
});
