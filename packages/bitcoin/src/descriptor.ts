import { parseXpub, type Network, type XpubProblem } from './xpub.ts';

/**
 * Tipos de script que se saben escribir y leer. wsh: multisig SegWit nativo (bc1q…, largo); sh-wsh: el mismo envuelto en
 * P2SH (3…); wpkh: single-sig SegWit nativo (bc1q…); sh-wpkh: single-sig envuelto (3…). Taproot, todavía no.
 */
export type ScriptType = 'wsh' | 'sh-wsh' | 'wpkh' | 'sh-wpkh';
export const MULTISIG_SCRIPTS: readonly ScriptType[] = ['wsh', 'sh-wsh'];
export const SINGLESIG_SCRIPTS: readonly ScriptType[] = ['wpkh', 'sh-wpkh'];
export const isMultisigScript = (s: ScriptType) => s === 'wsh' || s === 'sh-wsh';

/** Hasta 16 keys: OP_1…OP_16 en el script multisig. */
export const MAX_MULTISIG_KEYS = 16;

export interface DescriptorKey {
  /** Fingerprint de la semilla (8 hex, minúsculas). */
  fingerprint?: string;
  /** Derivación de la semilla a la xpub, sin "m/" y con ' para endurecida: 48'/0'/0'/2'. */
  path?: string;
  /** xpub o tpub, ya normalizada. */
  xpub: string;
}

export interface Descriptor {
  script: ScriptType;
  /** Solo multisig: cuántas firmas hacen falta. */
  threshold?: number;
  /** sortedmulti (las claves se ordenan, BIP-67) o multi (el orden escrito importa). Lo habitual es sortedmulti. */
  sorted: boolean;
  keys: DescriptorKey[];
}

// ---------- Suma de control (BIP-380) ----------

const INPUT_CHARSET = '0123456789()[],\'/*abcdefgh@:$%{}IJKLMNOPQRSTUVWXYZ&+-.;<=>?!^_|~ijklmnopqrstuvwxyzABCDEFGH`#"\\ ';
const CHECKSUM_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0xf5dee51989n, 0xa9fdca3312n, 0x1bab10e32dn, 0x3706b1677an, 0x644d626ffdn];

function polymod(symbols: number[]): bigint {
  let chk = 1n;
  for (const value of symbols) {
    const top = chk >> 35n;
    chk = ((chk & 0x7ffffffffn) << 5n) ^ BigInt(value);
    for (let i = 0; i < 5; i++) if ((top >> BigInt(i)) & 1n) chk ^= GENERATOR[i]!;
  }
  return chk;
}

/** Los 8 caracteres de la suma de control de un descriptor, o null si lleva caracteres no admitidos. */
export function descriptorChecksum(body: string): string | null {
  const symbols: number[] = [];
  let groups: number[] = [];
  for (const c of body) {
    const v = INPUT_CHARSET.indexOf(c);
    if (v < 0) return null;
    symbols.push(v & 31);
    groups.push(v >> 5);
    if (groups.length === 3) {
      symbols.push(groups[0]! * 9 + groups[1]! * 3 + groups[2]!);
      groups = [];
    }
  }
  if (groups.length === 1) symbols.push(groups[0]!);
  if (groups.length === 2) symbols.push(groups[0]! * 3 + groups[1]!);
  const checksum = polymod([...symbols, 0, 0, 0, 0, 0, 0, 0, 0]) ^ 1n;
  return Array.from({ length: 8 }, (_, i) => CHECKSUM_CHARSET[Number((checksum >> BigInt(5 * (7 - i))) & 31n)]).join('');
}

// ---------- Escribir ----------

/** Rama de derivación: <0;1> (recepción y cambio en uno, BIP-389), 0 (recepción) o 1 (cambio). */
export type Branch = 'multipath' | 0 | 1;

const keyExpression = (k: DescriptorKey, branch: Branch) => {
  const origin = k.fingerprint ? `[${k.fingerprint}${k.path ? `/${k.path}` : ''}]` : '';
  return `${origin}${k.xpub}/${branch === 'multipath' ? '<0;1>' : branch}/*`;
};

/** El descriptor de la cartera con su suma de control. */
export function formatDescriptor(d: Descriptor, branch: Branch = 'multipath'): string {
  const keys = d.keys.map((k) => keyExpression(k, branch));
  const inner = isMultisigScript(d.script) ? `${d.sorted ? 'sortedmulti' : 'multi'}(${d.threshold},${keys.join(',')})` : keys[0]!;
  const body = {
    wsh: `wsh(${inner})`,
    'sh-wsh': `sh(wsh(${inner}))`,
    wpkh: `wpkh(${inner})`,
    'sh-wpkh': `sh(wpkh(${inner}))`,
  }[d.script];
  return `${body}#${descriptorChecksum(body)}`;
}

// ---------- Leer ----------

export type DescriptorProblem =
  | { code: 'empty' }
  /** La suma de control no coincide: algo se copió mal. */
  | { code: 'bad-checksum' }
  /** Taproot, pkh, miniscript…: todavía no se leen. */
  | { code: 'unsupported-script' }
  | { code: 'syntax' }
  /** La key número `index` (desde 0) no se entiende o no es una xpub válida. */
  | { code: 'bad-key'; index: number; xpub?: XpubProblem }
  /** Lleva una clave privada: se rechaza entero y no se guarda nada. */
  | { code: 'private-key' }
  | { code: 'unsupported-suffix'; index: number }
  /** La misma xpub dos veces: la key número `index` repite una anterior. */
  | { code: 'duplicate-key'; index: number }
  | { code: 'mixed-networks' }
  | { code: 'threshold' }
  | { code: 'too-many-keys' };

export type ParsedDescriptor = { descriptor: Descriptor; network: Network; hadChecksum: boolean };
export type DescriptorResult = { ok: true; value: ParsedDescriptor } | { ok: false; problem: DescriptorProblem };

const unwrap = (s: string, name: string) => (s.startsWith(`${name}(`) && s.endsWith(')') ? s.slice(name.length + 1, -1) : null);

const KEY = /^(?:\[([0-9a-fA-F]{8})((?:\/\d+['hH]?)*)\])?([1-9A-HJ-NP-Za-km-z]+)(\/.*)?$/;
/** Una clave privada extendida al principio de una key (no en medio de una xpub, donde "…xprv…" puede salir por azar). */
const PRIVATE_KEY = /(^|[\](,])[xyzYZtuvUV]prv/;
const SUFFIXES = new Set(['/<0;1>/*', '/0/*', '/1/*']);

type KeyResult = { ok: true; key: DescriptorKey; network: Network } | { ok: false; problem: DescriptorProblem };

function parseKey(text: string, index: number): KeyResult {
  if (PRIVATE_KEY.test(text)) return { ok: false, problem: { code: 'private-key' } };
  const m = KEY.exec(text);
  if (!m) return { ok: false, problem: { code: 'bad-key', index } };
  const [, fingerprint, path, xpubText, suffix] = m;
  if (suffix === undefined || !SUFFIXES.has(suffix)) return { ok: false, problem: { code: 'unsupported-suffix', index } };
  const xpub = parseXpub(xpubText!);
  if (!xpub.ok) return { ok: false, problem: xpub.problem === 'private' ? { code: 'private-key' } : { code: 'bad-key', index, xpub: xpub.problem } };
  const key: DescriptorKey = { xpub: xpub.value.xpub };
  if (fingerprint) key.fingerprint = fingerprint.toLowerCase();
  if (path) key.path = path.slice(1).replace(/[hH]/g, "'");
  return { ok: true, key, network: xpub.value.network };
}

/**
 * Lee un descriptor tal como lo exportan Sparrow, Nunchuk, Bitcoin Core o Coldcard: wsh/sh-wsh con (sorted)multi, o
 * wpkh/sh-wpkh. Ignora espacios y saltos de línea. Si trae suma de control, la comprueba.
 */
export function parseDescriptor(text: string): DescriptorResult {
  const compact = text.replace(/\s+/g, '');
  if (compact === '') return { ok: false, problem: { code: 'empty' } };
  if (PRIVATE_KEY.test(compact)) return { ok: false, problem: { code: 'private-key' } };
  const [body = '', checksum, ...rest] = compact.split('#');
  if (rest.length > 0) return { ok: false, problem: { code: 'syntax' } };
  if (checksum !== undefined && descriptorChecksum(body) !== checksum) return { ok: false, problem: { code: 'bad-checksum' } };

  const sh = unwrap(body, 'sh');
  const outer = sh ?? body;
  const wsh = unwrap(outer, 'wsh');
  const wpkh = unwrap(outer, 'wpkh');
  let script: ScriptType;
  let threshold: number | undefined;
  let sorted = true;
  let keyTexts: string[];
  if (wsh !== null) {
    script = sh !== null ? 'sh-wsh' : 'wsh';
    const multi = unwrap(wsh, 'sortedmulti') ?? unwrap(wsh, 'multi');
    if (multi === null) return { ok: false, problem: { code: 'unsupported-script' } };
    sorted = wsh.startsWith('sortedmulti(');
    const [k, ...keys] = multi.split(',');
    if (!/^\d+$/.test(k ?? '')) return { ok: false, problem: { code: 'syntax' } };
    threshold = Number(k);
    keyTexts = keys;
    if (keys.length > MAX_MULTISIG_KEYS) return { ok: false, problem: { code: 'too-many-keys' } };
    if (threshold < 1 || threshold > keys.length) return { ok: false, problem: { code: 'threshold' } };
  } else if (wpkh !== null) {
    script = sh !== null ? 'sh-wpkh' : 'wpkh';
    keyTexts = [wpkh];
  } else {
    return { ok: false, problem: { code: /^[a-z_]+\(/.test(body) ? 'unsupported-script' : 'syntax' } };
  }

  const keys: DescriptorKey[] = [];
  const networks = new Set<Network>();
  for (const [i, t] of keyTexts.entries()) {
    const r = parseKey(t, i);
    if (!r.ok) return r;
    if (keys.some((k) => k.xpub === r.key.xpub)) return { ok: false, problem: { code: 'duplicate-key', index: i } };
    keys.push(r.key);
    networks.add(r.network);
  }
  if (networks.size > 1) return { ok: false, problem: { code: 'mixed-networks' } };
  const descriptor: Descriptor = { script, sorted, keys, ...(threshold !== undefined && { threshold }) };
  return { ok: true, value: { descriptor, network: [...networks][0]!, hadChecksum: checksum !== undefined } };
}

/** Normaliza una derivación escrita a mano ("m/48h/0h/0h/2h", "48'/0'/0'/2'") al formato de los descriptores, o null. */
export function normalizePath(text: string): string | null {
  const t = text.trim().replace(/^m\/?/, '');
  if (t === '') return '';
  if (!/^\d+['hH]?(\/\d+['hH]?)*$/.test(t)) return null;
  if (t.split('/').some((p) => Number.parseInt(p, 10) >= 2 ** 31)) return null;
  return t.replace(/[hH]/g, "'");
}
