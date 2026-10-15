import { analyzeMiniscript, mapMiniscriptKeys, miniscriptKeys, miniscriptToString, parseMiniscript, type Miniscript } from './miniscript.ts';
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
  /**
   * Par de ramas de recepción y cambio: 0 (sin indicar) es `<0;1>`, 1 es `<2;3>`, 2 es `<4;5>`… Solo en Miniscript,
   * donde una misma xpub puede firmar en varias ramas de la política (así lo escribe Liana): cada vez que aparece
   * lleva su par, para que las claves del script sean distintas.
   */
  multipath?: number;
}

export interface Descriptor {
  script: ScriptType;
  /** Solo multisig: cuántas firmas hacen falta. */
  threshold?: number;
  /** sortedmulti (las claves se ordenan, BIP-67) o multi (el orden escrito importa). Lo habitual es sortedmulti. */
  sorted: boolean;
  keys: DescriptorKey[];
  /**
   * Solo wsh: la política en Miniscript, con cada key como su índice en `keys`. Si está, manda sobre `threshold` y
   * `sorted` (Miniscript no tiene sortedmulti).
   */
  miniscript?: Miniscript<number>;
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

/** El paso de derivación de la rama (recepción o cambio) de una key: 0 o 1, o 2 o 3 en su segundo par… */
export const branchIndex = (k: DescriptorKey, branch: 0 | 1) => 2 * (k.multipath ?? 0) + branch;

const keyExpression = (k: DescriptorKey, branch: Branch) => {
  const origin = k.fingerprint ? `[${k.fingerprint}${k.path ? `/${k.path}` : ''}]` : '';
  const step = branch === 'multipath' ? `<${branchIndex(k, 0)};${branchIndex(k, 1)}>` : branchIndex(k, branch);
  return `${origin}${k.xpub}/${step}/*`;
};

/** El descriptor de la cartera con su suma de control. */
export function formatDescriptor(d: Descriptor, branch: Branch = 'multipath'): string {
  const keys = d.keys.map((k) => keyExpression(k, branch));
  if (d.miniscript) {
    const body = `wsh(${miniscriptToString(d.miniscript, (i) => keys[i]!)})`;
    return `${body}#${descriptorChecksum(body)}`;
  }
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
  /** Taproot, pkh, Miniscript dentro de sh(…), fragmentos que no existen…: no se leen. */
  | { code: 'unsupported-script' }
  /**
   * Miniscript que Bitcoin Core no aceptaría: tipos que no encajan, una forma de gastar sin firma, firmas que se
   * pueden alterar, timelocks de altura y de tiempo mezclados…
   */
  | { code: 'miniscript-unsafe' }
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
/** `/<a;a+1>/*` (a par) o `/n/*`: recepción y cambio juntos, o una sola rama. */
const SUFFIX = /^\/(?:<(\d{1,9});(\d{1,9})>|(\d{1,9}))\/\*$/;

/** El par de ramas de un sufijo (0 para `<0;1>`, `/0/*` y `/1/*`; 1 para `<2;3>`…), o null si no se admite. */
function suffixPair(suffix: string): number | null {
  const m = SUFFIX.exec(suffix);
  if (!m) return null;
  const [, a, b, single] = m;
  if (single !== undefined) return Math.floor(Number(single) / 2);
  return Number(a) % 2 === 0 && Number(b) === Number(a) + 1 ? Number(a) / 2 : null;
}

type KeyResult = { ok: true; key: DescriptorKey; network: Network } | { ok: false; problem: DescriptorProblem };

function parseKey(text: string, index: number, pairs: boolean): KeyResult {
  if (PRIVATE_KEY.test(text)) return { ok: false, problem: { code: 'private-key' } };
  const m = KEY.exec(text);
  if (!m) return { ok: false, problem: { code: 'bad-key', index } };
  const [, fingerprint, path, xpubText, suffix] = m;
  const pair = suffix === undefined ? null : suffixPair(suffix);
  if (pair === null || (pair > 0 && !pairs)) return { ok: false, problem: { code: 'unsupported-suffix', index } };
  const xpub = parseXpub(xpubText!);
  if (!xpub.ok) return { ok: false, problem: xpub.problem === 'private' ? { code: 'private-key' } : { code: 'bad-key', index, xpub: xpub.problem } };
  const key: DescriptorKey = { xpub: xpub.value.xpub };
  if (fingerprint) key.fingerprint = fingerprint.toLowerCase();
  if (path) key.path = path.slice(1).replace(/[hH]/g, "'");
  if (pair > 0) key.multipath = pair;
  return { ok: true, key, network: xpub.value.network };
}

/**
 * Lee un descriptor tal como lo exportan Sparrow, Nunchuk, Bitcoin Core, Coldcard o Liana: wsh/sh-wsh con
 * (sorted)multi, wpkh/sh-wpkh, o wsh con Miniscript. Ignora espacios y saltos de línea. Si trae suma de control, la comprueba.
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
    if (multi === null) return sh === null ? parseMiniscriptDescriptor(wsh, checksum !== undefined) : { ok: false, problem: { code: 'unsupported-script' } };
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

  const keys = parseKeys(keyTexts, false);
  if (!keys.ok) return keys;
  const descriptor: Descriptor = { script, sorted, keys: keys.keys, ...(threshold !== undefined && { threshold }) };
  return { ok: true, value: { descriptor, network: keys.network, hadChecksum: checksum !== undefined } };
}

/**
 * Las keys de un descriptor. Con `pairs` (Miniscript), una xpub puede repetirse si cada vez lleva su par de ramas
 * (`<0;1>`, `<2;3>`…); si no, cada xpub va una sola vez.
 */
function parseKeys(texts: readonly string[], pairs: boolean): { ok: true; keys: DescriptorKey[]; network: Network } | { ok: false; problem: DescriptorProblem } {
  const keys: DescriptorKey[] = [];
  const networks = new Set<Network>();
  for (const [i, t] of texts.entries()) {
    const r = parseKey(t, i, pairs);
    if (!r.ok) return r;
    const pair = r.key.multipath ?? 0;
    if (keys.some((k) => k.xpub === r.key.xpub && (!pairs || (k.multipath ?? 0) === pair))) return { ok: false, problem: { code: 'duplicate-key', index: i } };
    keys.push(r.key);
    networks.add(r.network);
  }
  if (networks.size > 1) return { ok: false, problem: { code: 'mixed-networks' } };
  return { ok: true, keys, network: [...networks][0]! };
}

/** wsh(miniscript): las keys, en el orden en que aparecen, pasan a ser índices. */
function parseMiniscriptDescriptor(text: string, hadChecksum: boolean): DescriptorResult {
  const parsed = parseMiniscript(text);
  if (!parsed.ok) return { ok: false, problem: { code: parsed.problem.code === 'syntax' ? 'syntax' : 'unsupported-script' } };
  const keyTexts = miniscriptKeys(parsed.value);
  if (keyTexts.length === 0) return { ok: false, problem: { code: 'miniscript-unsafe' } };
  const keys = parseKeys(keyTexts, true);
  if (!keys.ok) return keys;
  let next = 0;
  const miniscript = mapMiniscriptKeys(parsed.value, () => next++);
  if (!analyzeMiniscript(miniscript).sane) return { ok: false, problem: { code: 'miniscript-unsafe' } };
  const descriptor: Descriptor = { script: 'wsh', sorted: false, keys: keys.keys, miniscript };
  return { ok: true, value: { descriptor, network: keys.network, hadChecksum } };
}

/** Normaliza una derivación escrita a mano ("m/48h/0h/0h/2h", "48'/0'/0'/2'") al formato de los descriptores, o null. */
export function normalizePath(text: string): string | null {
  const t = text.trim().replace(/^m\/?/, '');
  if (t === '') return '';
  if (!/^\d+['hH]?(\/\d+['hH]?)*$/.test(t)) return null;
  if (t.split('/').some((p) => Number.parseInt(p, 10) >= 2 ** 31)) return null;
  return t.replace(/[hH]/g, "'");
}
