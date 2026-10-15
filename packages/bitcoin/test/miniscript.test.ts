import { describe, expect, it } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import { bech32 } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { analyzeMiniscript, deriveAddress, formatDescriptor, miniscriptScript, miniscriptToString, parseDescriptor, parseMiniscript } from '../src/index.ts';
import vectors from './vectors/core-miniscript.json' with { type: 'json' };

const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((b) => Number.parseInt(b, 16)));
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('Miniscript: vectores de Bitcoin Core (P2WSH)', () => {
  for (const t of vectors.tests) {
    it(t.ms.length > 90 ? `${t.ms.slice(0, 90)}…` : t.ms, () => {
      const parsed = parseMiniscript(t.ms);
      if (!t.valid) {
        expect(!parsed.ok || !analyzeMiniscript(parsed.value).topLevel).toBe(true);
        return;
      }
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const a = analyzeMiniscript(parsed.value);
      expect(a.topLevel).toBe(true);
      expect(a.nonMalleable).toBe(t.nonMalleable);
      expect(a.needsSignature).toBe(t.needsSig);
      expect(a.timelockMix).toBe(t.timelockMix);
      if ('ops' in t) expect([a.ops, a.stackItems]).toEqual([t.ops, t.stack]);
      if (t.script) expect(toHex(miniscriptScript(parsed.value, hex))).toBe(t.script);
      // Se escribe igual que se leyó (con las mismas abreviaturas) y se vuelve a leer igual.
      const again = parseMiniscript(miniscriptToString(parsed.value, (k) => k));
      expect(again).toEqual(parsed);
    });
  }
});

describe('Miniscript: lectura', () => {
  it('rechaza lo mal escrito y los fragmentos desconocidos', () => {
    expect(parseMiniscript('pk(A')).toEqual({ ok: false, problem: { code: 'syntax' } });
    expect(parseMiniscript('x:pk(A)')).toEqual({ ok: false, problem: { code: 'syntax' } });
    expect(parseMiniscript('older(01)')).toEqual({ ok: false, problem: { code: 'syntax' } });
    expect(parseMiniscript('multi_a(1,A)')).toEqual({ ok: false, problem: { code: 'unknown-fragment', name: 'multi_a' } });
  });

  it('cuenta las operaciones y la pila como Core: CHECKMULTISIG cuesta sus claves y pide k firmas y un 0', () => {
    const p = parseMiniscript('multi(1,A,B,C)');
    expect(p.ok && analyzeMiniscript(p.value)).toMatchObject({ ops: 4, stackItems: 2, withinLimits: true });
  });

  it('no da por seguro un script que pasa de 201 operaciones o de 100 elementos en el witness', () => {
    const chain = (n: number, part: (i: number) => string) => `${Array.from({ length: n }, (_, i) => `and_v(${part(i)},`).join('')}pk(Z)${')'.repeat(n)}`;
    // Cada v:older cuesta 2 operaciones (CSV y VERIFY) y nada en la pila.
    const ok = parseMiniscript(chain(100, () => 'v:older(1)'));
    const tooMany = parseMiniscript(chain(101, () => 'v:older(1)'));
    expect(ok.ok && analyzeMiniscript(ok.value)).toMatchObject({ ops: 201, stackItems: 1, sane: true });
    expect(tooMany.ok && analyzeMiniscript(tooMany.value)).toMatchObject({ ops: 203, withinLimits: false, sane: false });
    // Cada v:pkh pide firma y clave: 50 de ellas y la última firma son 101 elementos.
    const big = parseMiniscript(chain(50, (i) => `v:pkh(K${i})`));
    expect(big.ok && analyzeMiniscript(big.value)).toMatchObject({ stackItems: 101, withinLimits: false, sane: false });
  });

  it('marca las keys repetidas como no seguras', () => {
    const p = parseMiniscript('and_v(v:pk(A),pk(A))');
    expect(p.ok && analyzeMiniscript(p.value)).toMatchObject({ valid: true, duplicateKeys: true, sane: false });
  });
});

describe('descriptor wsh(miniscript)', () => {
  // De src/test/descriptor_tests.cpp de Bitcoin Core: la forma de la herencia simple de Liana.
  const CORE =
    'wsh(or_d(pk([2557c640/48h/1h/0h/2h]xpub6ArU6mnJDxmynaVKLV8FiFDaA9bVUw6efLEqt99qGK6B4QVWiNjc21JNFKkXNjgT8NCUmpFpSSBrYFtWEAqGirbqT4J1bRFpWyAnYdzmZUm/<0;1>/*),and_v(v:pkh([00aabb22/48h/1h/0h/2h]xpub6ArU6mnJDxmyogzqia2fdnD3gWHvfDtZAHdmKx4ccJwUBZd3rpgQM9qgmPAn1mqT2yh81uvGGohMkg3fNLoXZzn7sRo4a1X3KnCAVot2yuS/<0;1>/*),older(2))))';
  const PROGRAMS = {
    0: ['538436a60f2a638ea9e1e1342e9b93374aa7ec559ff0a805b3a185d4ba855d7f', '3a588d107d604b6913201c7c1e1722f07a0f8fb3a382744f17b9ae5f6ccfcdd7', 'd30fb375f7c491a208e77c7b5d0996ca14cf4a770c2ab5981f915c0e4565c74a'],
    1: ['72b5fc3a691c48fdbaf485f27e787b4094055d4b434c90c81ed1090f3d48733b', 'a9ccdf4496e5d60db4704b27494d9d74f54a16c180ff954a43ce5e3aa465113a', 'd17e21820a0069ca87049513eca763f08a74b586724441e7d76fc5142bcc327c'],
  } as const;

  it('lee el descriptor, da las mismas direcciones que Core y se escribe igual', () => {
    const r = parseDescriptor(CORE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { descriptor, network } = r.value;
    expect(descriptor.keys.map((k) => k.fingerprint)).toEqual(['2557c640', '00aabb22']);
    for (const branch of [0, 1] as const) {
      PROGRAMS[branch].forEach((program, index) => {
        expect(deriveAddress(descriptor, network, branch, index)).toBe(bech32.encode('bc', [0, ...bech32.toWords(hex(program))]));
      });
    }
    const written = formatDescriptor(descriptor);
    expect(written.split('#')[0]).toBe(CORE.replace(/h\//g, "'/").replace(/h\]/g, "']"));
    expect(parseDescriptor(written)).toEqual({ ok: true, value: { ...r.value, hadChecksum: true } });
  });

  it('rechaza el Miniscript que Core no aceptaría y el envuelto en sh(…)', () => {
    const key = CORE.slice(CORE.indexOf('pk(') + 3, CORE.indexOf('),and_v'));
    expect(parseDescriptor(`wsh(or_i(older(1),pk(${key})))`)).toEqual({ ok: false, problem: { code: 'miniscript-unsafe' } });
    expect(parseDescriptor('wsh(older(10))')).toEqual({ ok: false, problem: { code: 'miniscript-unsafe' } });
    expect(parseDescriptor(`sh(wsh(pk(${key})))`)).toEqual({ ok: false, problem: { code: 'unsupported-script' } });
    expect(parseDescriptor(`wsh(and_v(v:pk(${key}),pk(${key})))`)).toEqual({ ok: false, problem: { code: 'duplicate-key', index: 1 } });
  });
});

describe('una xpub en varias ramas (<2;3>, como Liana)', () => {
  const node = HDKey.fromMasterSeed(new Uint8Array(32).fill(9));
  const A = node.derive("m/48'/0'/0'/2'").publicExtendedKey;
  const B = HDKey.fromMasterSeed(new Uint8Array(32).fill(8)).derive("m/48'/0'/0'/2'").publicExtendedKey;
  const reused = `wsh(or_d(pk(${A}/<0;1>/*),and_v(v:pkh(${A}/<2;3>/*),older(10))))`;

  it('lee cada aparición con su par, la escribe igual y deriva la segunda por las ramas 2 y 3', () => {
    const r = parseDescriptor(reused);
    if (!r.ok) throw new Error(r.problem.code);
    expect(r.value.descriptor.keys.map((k) => k.multipath)).toEqual([undefined, 1]);
    expect(formatDescriptor(r.value.descriptor).split('#')[0]).toBe(reused);
    expect(formatDescriptor(r.value.descriptor, 1)).toContain(`${A}/3/*`);
    const account = HDKey.fromExtendedKey(A);
    for (const branch of [0, 1] as const) {
      const keys = [account.deriveChild(branch).deriveChild(4).publicKey!, account.deriveChild(2 + branch).deriveChild(4).publicKey!];
      const script = miniscriptScript(r.value.descriptor.miniscript!, (i) => keys[i]!);
      expect(deriveAddress(r.value.descriptor, 'mainnet', branch, 4)).toBe(bech32.encode('bc', [0, ...bech32.toWords(sha256(script))]));
    }
  });

  it('no admite la misma xpub en el mismo par, ni pares raros, ni otros pares fuera de Miniscript', () => {
    expect(parseDescriptor(reused.replace('<2;3>', '<0;1>'))).toEqual({ ok: false, problem: { code: 'duplicate-key', index: 1 } });
    expect(parseDescriptor(reused.replace('<2;3>', '<1;2>'))).toEqual({ ok: false, problem: { code: 'unsupported-suffix', index: 1 } });
    expect(parseDescriptor(`wsh(multi(2,${A}/<2;3>/*,${B}/<0;1>/*))`)).toEqual({ ok: false, problem: { code: 'unsupported-suffix', index: 0 } });
    expect(parseDescriptor(`wsh(multi(2,${A}/<0;1>/*,${A}/<2;3>/*))`)).toEqual({ ok: false, problem: { code: 'unsupported-suffix', index: 1 } });
  });
});

