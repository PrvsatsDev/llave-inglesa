import type { CustodyModel } from '@llave-inglesa/domain';
import { describe, expect, it } from 'vitest';
import { analyze, inheritanceLetter } from '../src/index.ts';
import { base, loadFixture, parse } from './helpers.ts';

const letterOf = (model: CustodyModel) => inheritanceLetter(model, analyze(model).inheritance);

describe('carta para los herederos', () => {
  it('lleva las piezas que se usan, con lo que aporta cada una, y los backups de reserva a los que también llegan', () => {
    const letter = letterOf(loadFixture('todo-en-casa'));
    expect(letter).toMatchObject({ status: 'ok', owners: ['yo'], heirs: ['pareja'], helpers: [], usesDescriptor: true, missingDescriptor: false, noDescriptorCopy: false });
    const piece = (item: string, needed: boolean, provides: unknown[]) => ({ item, kind: 'artifact', needed, provides, signs: [], needsPin: false, hasWallet: false });
    expect(letter.stops).toEqual([
      { location: 'casa', pieces: [piece('metal-k2', true, [{ type: 'seed', key: 'k2' }]), piece('desc-casa', true, [{ type: 'descriptor' }])] },
      { location: 'banco', pieces: [piece('metal-k1', true, [{ type: 'seed', key: 'k1' }]), piece('desc-banco', false, [{ type: 'descriptor' }])] },
      // Casa de mis padres no hace falta, pero llegan: sus backups van de reserva.
      { location: 'padres', pieces: [piece('arandelas-k3', false, [{ type: 'seed', key: 'k3' }]), piece('desc-padres', false, [{ type: 'descriptor' }])] },
    ]);
    // Los dispositivos que no se usan (el Coldcard, cuyo PIN solo sabe Yo) no salen.
    expect(letter.stops.flatMap((s) => s.pieces.map((p) => p.item))).not.toContain('ccq');
  });

  it('sin ninguna copia del descriptor recuperan reuniendo todas las semillas, y se avisa', () => {
    const model = loadFixture('todo-en-casa');
    const letter = letterOf({ ...model, artifacts: model.artifacts.filter((a) => !a.contents.some((c) => c.type === 'descriptor')) });
    expect(letter).toMatchObject({ status: 'ok', usesDescriptor: false, noDescriptorCopy: true });
    expect(letter.stops.map((s) => s.location)).toEqual(['casa', 'banco', 'padres']);
    expect(letter.stops.every((s) => s.pieces.every((p) => p.needed))).toBe(true);
  });

  it('sugiere guardarla primero donde los herederos solo entran tras el fallecimiento', () => {
    expect(letterOf(loadFixture('todo-en-casa')).storage).toEqual([
      { location: 'banco', conditional: true },
      { location: 'padres', conditional: true },
      { location: 'casa', conditional: false },
    ]);
  });

  it('lo que alguien sabe de memoria va aparte: quién, nunca cuál', () => {
    const model = loadFixture('singlesig-passphrase');
    const known: CustodyModel = {
      ...model,
      artifacts: model.artifacts.filter((a) => a.id !== 'papel-pass'),
      people: model.people.map((p) => (p.id === 'pareja' ? { ...p, knows: [...p.knows, { type: 'passphrase', key: 'k1' }] } : p)),
    };
    const letter = letterOf(known);
    expect(letter.memory).toEqual([{ person: 'pareja', secret: { type: 'passphrase', key: 'k1' } }]);
    expect(letter.stops.flatMap((s) => s.pieces.filter((p) => p.needed).map((p) => p.item))).toEqual(['metal-k1']);
  });

  it('un dispositivo con PIN que se usa para firmar lo dice', () => {
    const model = parse(
      base({
        keys: [{ id: 'k1', label: 'K1' }],
        policy: { type: 'key', key: 'k1' },
        people: [
          { id: 'yo', name: 'Yo', role: 'owner' },
          { id: 'hijo', name: 'Hijo', role: 'heir', knows: [{ type: 'pin', device: 'trezor' }] },
        ],
        devices: [{ id: 'trezor', label: 'Trezor', vendor: 'Trezor', kind: 'stateful', holds: ['k1'], pinProtected: true, location: 'casa' }],
        locations: [{ id: 'casa', name: 'Casa', access: [{ person: 'yo' }, { person: 'hijo', when: { type: 'after-death', person: 'yo' } }] }],
      }),
    );
    const letter = letterOf(model);
    expect(letter.stops).toEqual([{ location: 'casa', pieces: [{ item: 'trezor', kind: 'device', needed: true, provides: [], signs: ['k1'], needsPin: true, hasWallet: false }] }]);
    expect(letter.memory).toEqual([{ person: 'hijo', secret: { type: 'pin', device: 'trezor' } }]);
  });

  it('si no recuperan solo por faltar el descriptor, lo dice', () => {
    // Sin descriptores ni las arandelas de K3: tienen K1 y K2, pero no la xpub de K3.
    const model = loadFixture('todo-en-casa');
    const without: CustodyModel = {
      ...model,
      artifacts: model.artifacts.filter((a) => !a.contents.some((c) => c.type === 'descriptor') && !a.contents.some((c) => c.type === 'seed' && c.key === 'k3')),
      devices: model.devices.map((d) => ({ ...d, registeredWallet: false })),
    };
    const letter = letterOf(without);
    expect(letter).toMatchObject({ status: 'unrecoverable', stops: [], missingDescriptor: true });
  });

  it('si no recuperan por otra cosa, no culpa al descriptor', () => {
    expect(letterOf(loadFixture('referencia/r06-passphrase-solo-memoria'))).toMatchObject({ status: 'unrecoverable', missingDescriptor: false });
  });

  it('un custodio que no hace falta no se nombra (los herederos se bastan)', () => {
    const letter = letterOf(loadFixture('referencia/r10-2de3-custodio'));
    expect(letter).toMatchObject({ status: 'ok', helpers: [] });
    expect(letter.stops.length).toBeGreaterThan(0);
  });
});
