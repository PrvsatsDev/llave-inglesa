import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  base58check,
  deriveAddress,
  descriptorChecksum,
  formatDescriptor,
  looksLikeSeedWords,
  normalizePath,
  parseDescriptor,
  parseXpub,
  taprootOutputKey,
  type Descriptor,
  type ScriptType,
} from '../src/index.ts';

/** Vector 1 de BIP-32: la xpub maestra y su xprv. */
const XPUB = 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
const XPRV = 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';

/** Cambia los 4 bytes de versión de una clave extendida (para fabricar zpub, tpub…). */
function withVersion(key: string, version: number): string {
  const bytes = Uint8Array.from(base58check.decode(key));
  bytes.set([version >>> 24, (version >>> 16) & 0xff, (version >>> 8) & 0xff, version & 0xff], 0);
  return base58check.encode(bytes);
}

/** xpubs de cuenta deterministas, como las que exportaría un dispositivo. */
const accountXpub = (seed: number, testnet = false) => {
  const versions = testnet ? { public: 0x043587cf, private: 0x04358394 } : undefined;
  const node = HDKey.fromMasterSeed(Uint8Array.from({ length: 32 }, (_, i) => (i < 2 ? (seed >> (8 * i)) & 0xff : i)), versions);
  return { fingerprint: node.fingerprint.toString(16).padStart(8, '0'), xpub: node.derive("m/48'/0'/0'/2'").publicExtendedKey };
};

describe('suma de control de descriptores (BIP-380)', () => {
  it('coincide con el ejemplo de la especificación', () => {
    expect(descriptorChecksum('raw(deadbeef)')).toBe('89f8spxm');
  });

  it('rechaza caracteres fuera del alfabeto', () => {
    expect(descriptorChecksum('wsh(ñ)')).toBeNull();
  });
});

describe('xpubs', () => {
  it('acepta xpub tal cual', () => {
    expect(parseXpub(XPUB)).toEqual({ ok: true, value: { xpub: XPUB, network: 'mainnet', writtenAs: 'xpub', depth: 0 } });
  });

  it('convierte zpub/Zpub a xpub y vpub a tpub', () => {
    const zpub = parseXpub(withVersion(XPUB, 0x02aa7ed3));
    expect(zpub).toMatchObject({ ok: true, value: { xpub: XPUB, network: 'mainnet', writtenAs: 'Zpub' } });
    const vpub = parseXpub(withVersion(XPUB, 0x045f1cf6));
    expect(vpub).toMatchObject({ ok: true, value: { xpub: withVersion(XPUB, 0x043587cf), network: 'testnet', writtenAs: 'vpub' } });
  });

  it('rechaza las claves privadas, aunque se disfracen de otro prefijo', () => {
    expect(parseXpub(XPRV)).toEqual({ ok: false, problem: 'private' });
    expect(parseXpub(withVersion(XPRV, 0x0488b21e))).toEqual({ ok: false, problem: 'invalid' });
  });

  it('una letra mal copiada se detecta', () => {
    expect(parseXpub(XPUB.slice(0, 40) + (XPUB[40] === 'a' ? 'b' : 'a') + XPUB.slice(41))).toEqual({ ok: false, problem: 'invalid' });
    expect(parseXpub('hola')).toEqual({ ok: false, problem: 'invalid' });
  });

  it('reconoce una frase semilla pegada por error (también en español)', () => {
    expect(looksLikeSeedWords('abandon '.repeat(11) + 'about')).toBe(true);
    expect(looksLikeSeedWords('ábaco '.repeat(11) + 'abdomen')).toBe(true);
    expect(looksLikeSeedWords(XPUB)).toBe(false);
  });
});

describe('derivaciones', () => {
  it('normaliza m/, h y H a la forma de los descriptores', () => {
    expect(normalizePath("m/48h/0H/0'/2h")).toBe("48'/0'/0'/2'");
    expect(normalizePath('84/0/0')).toBe('84/0/0');
    expect(normalizePath('m/48x')).toBeNull();
    expect(normalizePath('m/2147483648')).toBeNull();
  });
});

const keys3 = [1, 2, 3].map((s) => ({ ...accountXpub(s), path: "48'/0'/0'/2'" }));
const multisig: Descriptor = { script: 'wsh', threshold: 2, sorted: true, keys: keys3 };

describe('descriptores', () => {
  it('escribe wsh(sortedmulti) con origen, rama <0;1> y suma de control', () => {
    const text = formatDescriptor(multisig);
    expect(text).toMatch(/^wsh\(sortedmulti\(2,\[[0-9a-f]{8}\/48'\/0'\/0'\/2'\]xpub\w+\/<0;1>\/\*,/);
    const [body, checksum] = text.split('#');
    expect(descriptorChecksum(body!)).toBe(checksum);
    expect(formatDescriptor(multisig, 0)).toContain('/0/*');
  });

  it('lee lo que escribe, con h o con apóstrofo, con espacios y saltos de línea', () => {
    for (const script of ['wsh', 'sh-wsh', 'wpkh', 'sh-wpkh'] as ScriptType[]) {
      const d: Descriptor = script.endsWith('wsh') ? { ...multisig, script } : { script, sorted: true, keys: [keys3[0]!] };
      expect(parseDescriptor(formatDescriptor(d))).toEqual({ ok: true, value: { descriptor: d, network: 'mainnet', hadChecksum: true } });
    }
    const withH = formatDescriptor(multisig, 0).split('#')[0]!.replaceAll("'", 'h');
    const spaced = withH.replace(/,/g, ',\n  ');
    expect(parseDescriptor(spaced)).toMatchObject({ ok: true, value: { descriptor: multisig, hadChecksum: false } });
  });

  it('acepta multi (orden fijo) y zpubs dentro del descriptor', () => {
    const text = `wsh(multi(2,${keys3.map((k) => withVersion(k.xpub, 0x02aa7ed3) + '/0/*').join(',')}))`;
    const r = parseDescriptor(text);
    expect(r).toMatchObject({ ok: true, value: { descriptor: { sorted: false, threshold: 2 } } });
    if (r.ok) expect(r.value.descriptor.keys.map((k) => k.xpub)).toEqual(keys3.map((k) => k.xpub));
  });

  it('explica por qué no se puede leer', () => {
    const good = formatDescriptor(multisig);
    const problem = (text: string) => {
      const r = parseDescriptor(text);
      return r.ok ? null : r.problem;
    };
    expect(problem('')).toEqual({ code: 'empty' });
    expect(problem(good.slice(0, -1) + (good.endsWith('q') ? 'p' : 'q'))).toEqual({ code: 'bad-checksum' });
    expect(problem(`tr(${keys3[0]!.xpub}/0/*,pk(${keys3[1]!.xpub}/0/*))`)).toEqual({ code: 'unsupported-script' });
    expect(problem(`sh(tr(${keys3[0]!.xpub}/0/*))`)).toEqual({ code: 'unsupported-script' });
    expect(problem(`wsh(sortedmulti(4,${keys3.map((k) => k.xpub + '/0/*').join(',')}))`)).toEqual({ code: 'threshold' });
    expect(problem(`wpkh(${keys3[0]!.xpub}/0/1)`)).toEqual({ code: 'unsupported-suffix', index: 0 });
    expect(problem(`wpkh(${keys3[0]!.xpub.slice(0, -1)}/0/*)`)).toEqual({ code: 'bad-key', index: 0, xpub: 'invalid' });
    expect(problem(`wpkh(${XPRV}/0/*)`)).toEqual({ code: 'private-key' });
    expect(problem(`wsh(sortedmulti(1,${keys3[0]!.xpub}/0/*,${keys3[0]!.xpub}/0/*))`)).toEqual({ code: 'duplicate-key', index: 1 });
    expect(problem(`wsh(sortedmulti(1,${keys3[0]!.xpub}/0/*,${accountXpub(9, true).xpub}/0/*))`)).toEqual({ code: 'mixed-networks' });
  });
});

describe('direcciones (contrastadas con @scure/btc-signer)', () => {
  const expected = (d: Descriptor, branch: 0 | 1, index: number, net = btc.NETWORK) => {
    const testnet = net !== btc.NETWORK;
    const versions = testnet ? { public: 0x043587cf, private: 0x04358394 } : undefined;
    const pubkeys = d.keys.map((k) => HDKey.fromExtendedKey(k.xpub, versions).deriveChild(branch).deriveChild(index).publicKey!);
    if (d.script === 'wpkh') return btc.p2wpkh(pubkeys[0]!, net).address;
    if (d.script === 'sh-wpkh') return btc.p2sh(btc.p2wpkh(pubkeys[0]!, net), net).address;
    if (d.script === 'tr') return btc.p2tr(pubkeys[0]!.slice(1), undefined, net).address;
    const sorted = d.sorted ? [...pubkeys].sort((a, b) => Buffer.compare(a, b)) : pubkeys;
    const wsh = btc.p2wsh(btc.p2ms(d.threshold!, sorted), net);
    return d.script === 'wsh' ? wsh.address : btc.p2sh(wsh, net).address;
  };

  it('vector conocido: P2WPKH de la clave pública del generador (BIP-173)', () => {
    const pubkey = Buffer.from('0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798', 'hex');
    expect(btc.p2wpkh(pubkey).address).toBe('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
  });

  it('multisig y single-sig, nativos y envueltos, mainnet y testnet, recepción y cambio', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 5 }),
        fc.constantFrom<ScriptType>('wsh', 'sh-wsh', 'wpkh', 'sh-wpkh', 'tr'),
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom<0 | 1>(0, 1),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 5 }),
        (seeds, script, sorted, testnet, branch, index, k) => {
          const keys = seeds.map((s) => accountXpub(s, testnet));
          const multi = script === 'wsh' || script === 'sh-wsh';
          const d: Descriptor = multi
            ? { script, sorted, threshold: Math.min(k, keys.length), keys }
            : { script, sorted: true, keys: [keys[0]!] };
          const net = testnet ? btc.TEST_NETWORK : btc.NETWORK;
          expect(deriveAddress(d, testnet ? 'testnet' : 'mainnet', branch, index)).toBe(expected(d, branch, index, net));
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('Taproot con una sola key (tr, BIP-86)', () => {
  // Vectores de BIP-86: «abandon abandon … about», cuenta 0 de mainnet.
  const bip86: Descriptor = {
    script: 'tr',
    sorted: true,
    keys: [{ fingerprint: '73c5da0a', path: "86'/0'/0'", xpub: 'xpub6BgBgsespWvERF3LHQu6CnqdvfEvtMcQjYrcRzx53QJjSxarj2afYWcLteoGVky7D3UKDP9QyrLprQ3VCECoY49yfdDEHGCtMMj92pReUsQ' }],
  };

  it('da las direcciones de los vectores de BIP-86', () => {
    expect(deriveAddress(bip86, 'mainnet', 0, 0)).toBe('bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr');
    expect(deriveAddress(bip86, 'mainnet', 0, 1)).toBe('bc1p4qhjn9zdvkux4e44uhx8tc55attvtyu358kutcqkudyccelu0was9fqzwh');
    expect(deriveAddress(bip86, 'mainnet', 1, 0)).toBe('bc1p3qkhfews2uk44qtvauqyr2ttdsw7svhkl9nkm9s9c3x4ax5h60wqwruhk7');
  });

  it('la clave de salida es la interna ajustada (vector de BIP-86)', () => {
    const internal = Buffer.from('cc8a4bc64d897bddc5fbc2f670f7a8ba0b386779106cf1223c6fc5d7cd6fc115', 'hex');
    expect(Buffer.from(taprootOutputKey(internal)).toString('hex')).toBe('a60869f0dbcf1dc659c9cecbaf8050135ea9e8cdc487053f1dc6880949dc684c');
  });

  it('escribe tr(KEY) con origen, rama <0;1> y suma de control, y lo lee igual', () => {
    const text = formatDescriptor(bip86);
    expect(text.split('#')[0]).toBe(`tr([73c5da0a/86'/0'/0']${bip86.keys[0]!.xpub}/<0;1>/*)`);
    const back = parseDescriptor(text);
    expect(back.ok && back.value).toEqual({ descriptor: bip86, network: 'mainnet', hadChecksum: true });
  });

  it('lee el descriptor que exporta Frostsnap (ruta propia, sin endurecer)', () => {
    const { xpub } = accountXpub(7);
    const r = parseDescriptor(`tr([12345678/0/0]${xpub}/<0;1>/*)`);
    expect(r.ok && r.value.descriptor).toEqual({ script: 'tr', sorted: true, keys: [{ fingerprint: '12345678', path: '0/0', xpub }] });
  });
});
