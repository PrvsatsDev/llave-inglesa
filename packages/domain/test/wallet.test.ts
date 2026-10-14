import { readFileSync } from 'node:fs';
import { formatDescriptor, parseDescriptor, type Descriptor } from '@llave-inglesa/bitcoin';
import { HDKey } from '@scure/bip32';
import { describe, expect, it } from 'vitest';
import {
  CustodyModelSchema,
  importDescriptor,
  parseModel,
  setWallet,
  updateKey,
  walletDescriptor,
  walletOf,
  type CustodyModel,
} from '../src/index.ts';

function fixture(name: string): CustodyModel {
  const r = parseModel(JSON.parse(readFileSync(new URL(`../../../fixtures/${name}.json`, import.meta.url), 'utf8')));
  if (!r.ok) throw new Error(name);
  return r.model;
}

/** xpubs de cuenta de semillas de prueba (no son de nadie). */
const account = (seed: number, testnet = false) => {
  const versions = testnet ? { public: 0x043587cf, private: 0x04358394 } : undefined;
  const node = HDKey.fromMasterSeed(Uint8Array.from({ length: 32 }, (_, i) => (i === 0 ? seed : i)), versions);
  return { fingerprint: node.fingerprint.toString(16).padStart(8, '0'), path: "48'/0'/0'/2'", xpub: node.derive("m/48'/0'/0'/2'").publicExtendedKey };
};
const [a, b, c] = [account(1), account(2), account(3)];
const twoOfThree: Descriptor = { script: 'wsh', threshold: 2, sorted: true, keys: [a, b, c] };
const parse = (d: Descriptor) => {
  const r = parseDescriptor(formatDescriptor(d));
  if (!r.ok) throw new Error('descriptor');
  return r.value;
};

describe('descriptor a partir del esquema', () => {
  it('sin xpubs dice cuáles faltan', () => {
    expect(walletDescriptor(fixture('todo-en-casa'))).toEqual({ ok: false, problems: [{ code: 'missing-xpub', keys: ['k1', 'k2', 'k3'] }] });
  });

  it('por defecto wsh con sortedmulti si es multisig, y wpkh si es single-sig', () => {
    expect(walletOf(fixture('todo-en-casa'))).toEqual({ script: 'wsh', sorted: true });
    expect(walletOf(fixture('singlesig-passphrase'))).toEqual({ script: 'wpkh', sorted: true });
  });

  it('importar y volver a escribir da el mismo descriptor', () => {
    const r = importDescriptor(fixture('todo-en-casa'), parse(twoOfThree));
    if (!r.ok) throw new Error(r.problem.code);
    expect(r.matches).toEqual([
      { key: 'k1', by: 'order' },
      { key: 'k2', by: 'order' },
      { key: 'k3', by: 'order' },
    ]);
    expect(r.model.keys[0]).toMatchObject({ fingerprint: a.fingerprint, derivation: "48'/0'/0'/2'", xpub: a.xpub });
    const back = walletDescriptor(r.model);
    expect(back).toEqual({ ok: true, descriptor: twoOfThree, network: 'mainnet', warnings: [] });
    // Lo importado cumple el esquema del documento.
    expect(CustodyModelSchema.safeParse(r.model).success).toBe(true);
    // Reimportar empareja por xpub.
    const again = importDescriptor(r.model, parse(twoOfThree));
    expect(again.ok && again.matches.every((m) => m.by === 'xpub')).toBe(true);
  });

  it('empareja por fingerprint aunque el descriptor traiga las keys en otro orden', () => {
    let model = fixture('todo-en-casa');
    model = updateKey(model, 'k1', { fingerprint: c.fingerprint.toUpperCase() });
    model = updateKey(model, 'k3', { fingerprint: a.fingerprint });
    const r = importDescriptor(model, parse(twoOfThree));
    if (!r.ok) throw new Error(r.problem.code);
    expect(r.matches).toEqual([
      { key: 'k1', by: 'fingerprint' },
      { key: 'k2', by: 'order' },
      { key: 'k3', by: 'fingerprint' },
    ]);
    expect(r.model.keys.find((k) => k.id === 'k1')!.xpub).toBe(c.xpub);
    expect(r.model.keys.find((k) => k.id === 'k3')!.xpub).toBe(a.xpub);
  });

  it('un fingerprint del esquema que no está en el descriptor no se empareja a ciegas', () => {
    const model = updateKey(fixture('todo-en-casa'), 'k2', { fingerprint: 'deadbeef' });
    expect(importDescriptor(model, parse(twoOfThree))).toEqual({ ok: false, problem: { code: 'fingerprint-not-found', key: 'k2' } });
  });

  it('si el descriptor tiene otra forma no toca el esquema y lo explica', () => {
    expect(importDescriptor(fixture('todo-en-casa'), parse({ ...twoOfThree, threshold: 3 }))).toEqual({
      ok: false,
      problem: { code: 'shape-mismatch', descriptor: { k: 3, n: 3 }, model: { k: 2, n: 3 } },
    });
    expect(importDescriptor(fixture('singlesig-passphrase'), parse(twoOfThree))).toMatchObject({ ok: false, problem: { code: 'shape-mismatch' } });
  });

  it('single-sig envuelto (sh-wpkh) se guarda como tipo de script', () => {
    const r = importDescriptor(fixture('singlesig-passphrase'), parse({ script: 'sh-wpkh', sorted: true, keys: [a] }));
    expect(r.ok && r.model.wallet).toEqual({ script: 'sh-wpkh', sorted: true });
  });

  it('avisa de lo que impide escribirlo', () => {
    const r = importDescriptor(fixture('todo-en-casa'), parse(twoOfThree));
    if (!r.ok) throw new Error();
    expect(walletDescriptor(setWallet(r.model, { script: 'wpkh', sorted: true }))).toEqual({ ok: false, problems: [{ code: 'script-mismatch' }] });
    expect(walletDescriptor(updateKey(r.model, 'k2', { xpub: a.xpub }))).toEqual({ ok: false, problems: [{ code: 'duplicate-xpub', keys: ['k1', 'k2'] }] });
    expect(walletDescriptor(updateKey(r.model, 'k2', { xpub: account(2, true).xpub }))).toEqual({ ok: false, problems: [{ code: 'mixed-networks' }] });
    expect(walletDescriptor(updateKey(r.model, 'k2', { xpub: a.xpub.slice(0, -1) + (a.xpub.endsWith('a') ? 'b' : 'a') }))).toEqual({
      ok: false,
      problems: [{ code: 'invalid-xpub', keys: ['k2'] }],
    });
    const noOrigin = walletDescriptor(updateKey(r.model, 'k3', { derivation: undefined }));
    expect(noOrigin).toMatchObject({ ok: true, warnings: [{ code: 'missing-origin', keys: ['k3'] }] });
    const nested = { ...r.model, policy: { type: 'thresh' as const, k: 1, of: [r.model.policy, { type: 'key' as const, key: 'k1' }] } };
    expect(walletDescriptor(nested)).toEqual({ ok: false, problems: [{ code: 'no-miniscript' }] });
  });

  it('con espera, escribe wsh(miniscript) aunque se hubiera elegido otro tipo de script', () => {
    let model = fixture('referencia/r14-2de3-se-relaja');
    model = setWallet(model, { script: 'sh-wsh', sorted: true });
    for (const [i, id] of ['k1', 'k2', 'k3'].entries()) model = updateKey(model, id, { xpub: [a, b, c][i]!.xpub, fingerprint: [a, b, c][i]!.fingerprint, derivation: a.path });
    const r = walletDescriptor(model);
    if (!r.ok) throw new Error(r.problems[0]!.code);
    expect(formatDescriptor(r.descriptor)).toMatch(/^wsh\(thresh\(2,pk\(\[[0-9a-f]{8}\/48'\/0'\/0'\/2'\]xpub\w+\/<0;1>\/\*\),s:pk\(.*\),sln:older\(52560\)\)\)#[a-z0-9]{8}$/);
  });

  it('el documento nunca admite una clave privada en el hueco de la xpub', () => {
    const model = fixture('singlesig-passphrase');
    const xprv = HDKey.fromMasterSeed(new Uint8Array(32).fill(7)).privateExtendedKey;
    expect(CustodyModelSchema.safeParse({ ...model, keys: [{ ...model.keys[0], xpub: xprv }] }).success).toBe(false);
  });
});

describe('descriptor con Miniscript', () => {
  const d = account(4);
  /** El ejemplo con sus keys rellenas en orden: k1 = a, k2 = b… */
  const filled = (name: string) => {
    let model = fixture(name);
    model.keys.forEach((k, i) => {
      const x = [a, b, c, d][i]!;
      model = updateKey(model, k.id, { xpub: x.xpub, fingerprint: x.fingerprint, derivation: x.path });
    });
    return model;
  };
  const empty = (name: string) => {
    let model = fixture(name);
    for (const k of model.keys) model = updateKey(model, k.id, { xpub: undefined, fingerprint: undefined, derivation: undefined });
    return model;
  };
  const written = (model: CustodyModel) => {
    const r = walletDescriptor(model);
    if (!r.ok) throw new Error(r.problems[0]!.code);
    return r.descriptor;
  };

  for (const name of ['referencia/r13-recuperacion-heredera', 'referencia/r14-2de3-se-relaja', 'referencia/r15-2de3-se-amplia']) {
    it(`${name}: importar lo escrito rellena las mismas keys y da el mismo descriptor`, () => {
      const descriptor = written(filled(name));
      const r = importDescriptor(empty(name), parse(descriptor));
      if (!r.ok) throw new Error(r.problem.code);
      expect(written(r.model)).toEqual(descriptor);
      expect(CustodyModelSchema.safeParse(r.model).success).toBe(true);
    });
  }

  it('empareja la de recuperación con la de recuperación, aunque el fingerprint esté en otra key', () => {
    const descriptor = written(filled('referencia/r13-recuperacion-heredera'));
    // Sin nada que comparar, la principal del descriptor solo puede ser la principal del esquema.
    const r = importDescriptor(empty('referencia/r13-recuperacion-heredera'), parse(descriptor));
    expect(r.ok && r.model.keys.find((k) => k.id === 'k2')!.xpub).toBe(b.xpub);
    // Un fingerprint de la principal puesto en la de recuperación no se empareja.
    const wrong = updateKey(empty('referencia/r13-recuperacion-heredera'), 'k2', { fingerprint: a.fingerprint });
    expect(importDescriptor(wrong, parse(descriptor))).toEqual({ ok: false, problem: { code: 'fingerprint-not-found', key: 'k2' } });
  });

  it('si la forma, el umbral o la espera no coinciden, no toca el esquema y lo explica', () => {
    const r14 = written(filled('referencia/r14-2de3-se-relaja'));
    expect(importDescriptor(empty('referencia/r15-2de3-se-amplia'), parse(r14))).toMatchObject({ ok: false, problem: { code: 'policy-mismatch' } });
    expect(importDescriptor(empty('todo-en-casa'), parse(r14))).toMatchObject({
      ok: false,
      problem: { code: 'policy-mismatch', descriptor: { kind: 'decaying', k: 2 }, model: { kind: 'plain', k: 2 } },
    });
    const longer = { ...r14, miniscript: JSON.parse(JSON.stringify(r14.miniscript).replace('52560', '52561')) };
    expect(importDescriptor(empty('referencia/r14-2de3-se-relaja'), parse(longer))).toMatchObject({ ok: false, problem: { code: 'policy-mismatch' } });
    // Un multisig clásico en un esquema con espera.
    expect(importDescriptor(empty('referencia/r14-2de3-se-relaja'), parse(twoOfThree))).toMatchObject({
      ok: false,
      problem: { code: 'policy-mismatch', descriptor: { kind: 'plain', k: 2 }, model: { kind: 'decaying' } },
    });
  });

  it('un Miniscript que no es ninguna plantilla no se importa', () => {
    const parsed = parseDescriptor(`wsh(and_v(v:pk(${a.xpub}/<0;1>/*),after(800000)))`);
    if (!parsed.ok) throw new Error(parsed.problem.code);
    expect(importDescriptor(empty('referencia/r13-recuperacion-heredera'), parsed.value)).toEqual({ ok: false, problem: { code: 'descriptor-policy' } });
  });
});
