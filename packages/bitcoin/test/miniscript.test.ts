import { describe, expect, it } from 'vitest';
import { bech32 } from '@scure/base';
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
