import { addArtifact, addComputer, addDevice, addLocation, addPerson, blankModel, indexModel, setDeviceShares, setKeyCoordinators, splitKey, updateArtifact, updateDevice, updateLocation, type CustodyModel } from '@llave-inglesa/domain';
import { analyze, inheritanceLetter } from '@llave-inglesa/engine';
import { describe, expect, it } from 'vitest';
import { factText, letterPieceText, letterSteps, setIdioma } from '../src/index.ts';

/** Frostsnap 2 de 3 (casa, oficina y banco) con el móvil encima del titular; la heredera entra en casa y en el banco al fallecer. */
function frostsnap(): CustodyModel {
  let m = splitKey(blankModel(), 'k1', 'frost', 2, 3);
  const oficina = addLocation(m, 'Oficina');
  const banco = addLocation(oficina.model, 'Banco');
  m = banco.model;
  for (const [i, location] of (['casa', oficina.id, banco.id] as const).entries()) {
    const d = addDevice(m, location, 'stateful', `Frostsnap ${i + 1}`);
    m = setDeviceShares(updateDevice(d.model, d.id, { vendor: 'Frostsnap', pinProtected: false }), d.id, [{ key: 'k1', share: i + 1 }]);
  }
  const phone = addComputer(m, { carriedBy: 'yo' }, 'Móvil');
  m = setKeyCoordinators(phone.model, 'k1', [phone.id]);
  const heir = addPerson(m, 'Ana', 'heir');
  m = heir.model;
  for (const l of ['casa', banco.id]) {
    const loc = m.locations.find((x) => x.id === l)!;
    m = updateLocation(m, l, { access: [...loc.access, { person: heir.id, when: { type: 'after-death', person: 'yo' } }] });
  }
  return m;
}

describe('carta para los herederos con una key FROST', () => {
  const model = frostsnap();
  const letter = inheritanceLetter(model, analyze(model).inheritance);
  const label = indexModel(model).label;

  it('recuperan con dos dispositivos (emparejando un móvil nuevo) y cada uno dice qué share firma', () => {
    expect(letter.status).toBe('ok');
    const pieces = letter.stops.flatMap((s) => s.pieces).filter((p) => p.needed);
    expect(pieces.map((p) => p.signsShares)).toEqual([[{ key: 'k1', share: 1 }], [{ key: 'k1', share: 3 }]]);
    setIdioma('es');
    expect(letterPieceText(pieces[0]!, label)).toBe('firma su parte de K1 (share 1)');
  });

  it('los pasos explican la app de Frostsnap, los dispositivos en blanco y qué hacer si no existiera', () => {
    setIdioma('es');
    const steps = letterSteps(model, letter).join('\n');
    expect(steps).toContain('app de Frostsnap');
    expect(steps).toContain('«en blanco»');
    expect(steps).toContain('frostsnap-thaw');
    expect(steps).not.toContain('Carga la frase semilla');
    setIdioma('en');
    expect(letterSteps(model, letter).join('\n')).toContain('frostsnap-thaw');
    setIdioma('es');
  });

  it('el secreto completo de una key FROST no se llama semilla', () => {
    setIdioma('es');
    expect(factText({ kind: 'secret', secret: { type: 'seed', key: 'k1' } }, indexModel(model))).toBe('secreto completo de K1');
  });
});

describe('carta para los herederos con una key Shamir', () => {
  it('explica que se juntan las shares en un dispositivo que admita su formato', () => {
    let m = splitKey(blankModel(), 'k1', 'shamir', 2, 3);
    for (let i = 1; i <= 3; i++) {
      const a = addArtifact(m, 'casa');
      m = updateArtifact(a.model, a.id, { contents: [{ type: 'share', key: 'k1', share: i }] });
    }
    const heir = addPerson(m, 'Ana', 'heir');
    m = updateLocation(heir.model, 'casa', { access: [...heir.model.locations[0]!.access, { person: heir.id, when: { type: 'after-death', person: 'yo' } }] });
    const letter = inheritanceLetter(m, analyze(m).inheritance);
    setIdioma('es');
    const steps = letterSteps(m, letter).join('\n');
    expect(steps).toContain('SLIP-39');
    expect(steps).not.toContain('Carga la frase semilla');
  });
});
