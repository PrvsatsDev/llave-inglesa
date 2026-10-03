import { readFileSync } from 'node:fs';
import { ADVISORIES, advisoriesFor, indexModel, parseModel, removeArtifact, updateDevice, type CustodyModel } from '@llave-inglesa/domain';
import { analyze } from '@llave-inglesa/engine';
import { describe, expect, it } from 'vitest';
import { ADVISORY_TITLE, advisoryText, attackText, duressText, inheritanceText, lossText, secretText } from '../src/index.ts';

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
    expect(lossText({ type: 'destroy-location', location: 'casa', disaster: 'fire' }, index)).toBe('Incendio en Casa');
    expect(lossText({ type: 'destroy-location', location: 'casa', disaster: 'flood' }, index)).toBe('Inundación en Casa');
    expect(lossText({ type: 'destroy-location', location: 'casa', disaster: 'total' }, index)).toBe('Pérdida del acceso a Casa');
    expect(lossText({ type: 'destroy-location', location: 'portatil', disaster: 'total' }, index)).toBe('Avería de Portátil');
    expect(lossText({ type: 'destroy-location', location: 'nube', disaster: 'total' }, index)).toBe('Pérdida de la cuenta iCloud');
  });

  it('contraseñas', () => {
    expect(secretText({ type: 'password', artifact: 'desc' }, index.label)).toBe('contraseña de Descriptor');
  });
});

describe('avisos del catálogo', () => {
  it('todos los avisos tienen título', () => {
    for (const a of ADVISORIES) expect(ADVISORY_TITLE[a.id], a.id).toBeDefined();
  });

  it('Coldcard sin firmware: afectado por defecto, explotado y con mitigaciones', () => {
    const t = advisoryText(advisoriesFor('coldcard-q')[0]!);
    expect(t.title).toContain('Coldcard');
    expect(t.detail).toContain('Ya se ha explotado');
    expect(t.detail).toContain('Sin saber la versión');
    expect(t.detail).toContain('1.5.0');
    expect(t.mitigations).toBe('Mitiga: mezclar al menos 128 bits de entropía propia (unas 50 tiradas de dado) o passphrase.');
  });

  it('versión de otro modelo', () => {
    expect(advisoryText(advisoriesFor('coldcard-q', '5.5.2')[0]!).detail).toContain('No reconocemos esa versión');
  });

  it('sin arreglo por firmware', () => {
    const t = advisoryText(advisoriesFor('trezor-one', '1.12.1')[0]!);
    expect(t.detail).toContain('No se puede corregir por firmware.');
    expect(t.detail).not.toContain('Sin saber la versión');
  });
});

describe('ataques de entropía: hipotético frente a conocido', () => {
  it('distingue el fallo aún desconocido del publicado', () => {
    expect(attackText({ type: 'entropy-compromise', origin: { kind: 'vendor', vendor: 'SeedSigner' } }, index)).toBe('RNG con fallo aún desconocido: SeedSigner');
    expect(attackText({ type: 'known-weak-entropy', advisory: 'coldcard-rng-2026' }, index)).toBe('Semilla adivinable por un fallo publicado: Coldcard 2026');
  });
});

describe('texto de la herencia', () => {
  const people = [
    { id: 'pareja', name: 'Pareja', role: 'heir' as const, knows: [] },
    { id: 'hijo', name: 'Hijo', role: 'heir' as const, knows: [] },
    { id: 'hermano', name: 'Hermano', role: 'custodian' as const, knows: [] },
  ];
  const ok = { score: 90, status: 'ok' as const, heirs: ['pareja'], helpers: [], locations: ['casa'], visits: 1, losses: [], lossRarities: [], lossCombinedRarity: null };

  it('nombra a los herederos con su papel y, solo si hace falta, a quien les ayuda', () => {
    expect(inheritanceText(ok, people)).toBe('Pareja (heredero/a) recupera los fondos');
    expect(inheritanceText({ ...ok, heirs: ['pareja', 'hijo'], helpers: ['hermano'] }, people)).toBe(
      'Pareja (heredero/a) y Hijo (heredero/a) recuperan los fondos con la ayuda de Hermano (custodio/a)',
    );
  });

  it('sin herederos, lo dice aunque un custodio pueda recuperar', () => {
    expect(inheritanceText({ ...ok, heirs: [], helpers: ['hermano'] }, people)).toBe(
      'Nadie tiene papel de heredero, pero Hermano (custodio/a) puede recuperar los fondos',
    );
  });
});

describe('texto del PIN de coacción', () => {
  const r06 = parseModel(JSON.parse(readFileSync(new URL('../../../fixtures/referencia/r06-passphrase-solo-memoria.json', import.meta.url), 'utf8')));
  if (!r06.ok) throw new Error('R06');
  const withDuress = updateDevice(r06.model, 'nuevo-dispositivo', { duressPin: true });
  const say = (m: CustodyModel) => {
    const a = analyze(m);
    return duressText(a.duress[0]!, a.security, indexModel(m));
  };

  it('no ayuda: explica que la llave inglesa da la placa', () => {
    expect(say(withDuress)).toBe(
      'El PIN de coacción de Trezor no cambia la nota: con llave inglesa a Yo en Casa no hace falta desbloquearlo, porque el atacante se lleva Backup K1.',
    );
  });

  it('ayuda: dice cuánto encarece el robo más barato', () => {
    expect(say(removeArtifact(withDuress, 'nuevo-backup'))).toBe(
      'El PIN de coacción de Trezor encarece el robo más barato: esfuerzo 3,5 → 4,5 (seguridad 73 → 85).',
    );
  });
});
