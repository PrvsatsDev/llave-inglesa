import { ripemd160 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Miniscript en P2WSH (BIP-379): leer, escribir, comprobar tipos y generar el script. Las reglas de tipos son las de
 * Bitcoin Core (src/script/miniscript.cpp) y los tests usan sus vectores. Sin Tapscript (`multi_a`): solo `wsh(...)`.
 *
 * Las keys son genéricas: texto al leer, índices en un descriptor, claves públicas al generar el script.
 */
export type Miniscript<K> =
  | { f: '0' | '1' }
  | { f: 'pk_k' | 'pk_h'; key: K }
  | { f: 'older' | 'after'; n: number }
  | { f: HashFragment; hash: string }
  | { f: 'multi'; k: number; keys: K[] }
  | { f: Wrapper; x: Miniscript<K> }
  | { f: 'and_v' | 'and_b' | 'or_b' | 'or_c' | 'or_d' | 'or_i'; x: Miniscript<K>; y: Miniscript<K> }
  | { f: 'andor'; x: Miniscript<K>; y: Miniscript<K>; z: Miniscript<K> }
  | { f: 'thresh'; k: number; subs: Miniscript<K>[] };

export type HashFragment = 'sha256' | 'hash256' | 'ripemd160' | 'hash160';
export type Wrapper = 'a' | 's' | 'c' | 'd' | 'v' | 'j' | 'n';

const HASH_LENGTH: Record<HashFragment, number> = { sha256: 32, hash256: 32, ripemd160: 20, hash160: 20 };
const WRAPPERS = new Set<string>(['a', 's', 'c', 'd', 'v', 'j', 'n']);
const BINARY = new Set<string>(['and_v', 'and_b', 'or_b', 'or_c', 'or_d', 'or_i']);
/** Keys por `multi` en P2WSH. */
export const MAX_MULTI_KEYS = 20;
/** Tamaño máximo de un witness script (regla de estandaridad). */
export const MAX_WSH_SCRIPT_SIZE = 3600;
/** Operaciones no push por script, contando las claves de cada CHECKMULTISIG que se ejecuta (consenso). */
export const MAX_OPS_PER_SCRIPT = 201;
/** Elementos del witness en P2WSH, sin contar el script (regla de estandaridad). */
export const MAX_WSH_STACK_ITEMS = 100;
/** older(n) con este bit cuenta tiempo (unidades de 512 s) en vez de bloques (BIP-68). */
export const SEQUENCE_TYPE_FLAG = 1 << 22;
const LOCKTIME_THRESHOLD = 500_000_000;

// ---------- Tipos ----------

/**
 * Propiedades de tipo como máscara de bits, con las letras de Core: tipo base (B, V, K, W), z/o/n/d/u, malleabilidad
 * (e, f, s, m), x (verify caro) y timelocks (g/h relativos por tiempo/altura, i/j absolutos, k = no se mezclan).
 */
const LETTERS = 'BVKWzonduefsmxghijk';
type Type = number;
const T = (letters: string): Type => [...letters].reduce((t, c) => t | (1 << LETTERS.indexOf(c)), 0);
const has = (t: Type, letters: string) => (t & T(letters)) === T(letters);
const when = (cond: boolean, t: Type) => (cond ? t : 0);

function mixesTimelocks(x: Type, y: Type): boolean {
  return (has(x, 'g') && has(y, 'h')) || (has(x, 'h') && has(y, 'g')) || (has(x, 'i') && has(y, 'j')) || (has(x, 'j') && has(y, 'i'));
}

/** ¿Tiene la expresión todas estas propiedades de tipo (p. ej. 'Bdu')? Falso si no es válida. */
export function miniscriptHas<K>(ms: Miniscript<K>, letters: string): boolean {
  const t = miniscriptType(ms);
  return t !== 0 && has(t, letters);
}

/** Tipo de una expresión: 0 si no es válida. */
function miniscriptType<K>(ms: Miniscript<K>): Type {
  const t = computeType(ms);
  const bases = [...'BVKW'].filter((c) => has(t, c)).length;
  return bases === 1 ? t : 0;
}

function computeType<K>(ms: Miniscript<K>): Type {
  switch (ms.f) {
    case '0':
      return T('Bzudemsxk');
    case '1':
      return T('Bzufmxk');
    case 'pk_k':
      return T('Konudemsxk');
    case 'pk_h':
      return T('Knudemsxk');
    case 'older':
      if (!validLock(ms.n)) return 0;
      return T((ms.n & SEQUENCE_TYPE_FLAG) !== 0 ? 'g' : 'h') | T('Bzfmxk');
    case 'after':
      if (!validLock(ms.n)) return 0;
      return T(ms.n >= LOCKTIME_THRESHOLD ? 'i' : 'j') | T('Bzfmxk');
    case 'sha256':
    case 'hash256':
    case 'ripemd160':
    case 'hash160':
      return /^[0-9a-f]+$/.test(ms.hash) && ms.hash.length === 2 * HASH_LENGTH[ms.f] ? T('Bonudmk') : 0;
    case 'multi':
      return ms.k >= 1 && ms.k <= ms.keys.length && ms.keys.length <= MAX_MULTI_KEYS ? T('Bnudemsk') : 0;
    case 'thresh':
      return threshType(ms.k, ms.subs.map(miniscriptType));
  }
  if (ms.f === 'andor') return andorType(miniscriptType(ms.x), miniscriptType(ms.y), miniscriptType(ms.z));
  if ('y' in ms) return binaryType(ms.f, miniscriptType(ms.x), miniscriptType(ms.y));
  return wrapperType(ms.f, miniscriptType(ms.x));
}

const validLock = (n: number) => Number.isInteger(n) && n >= 1 && n < 0x80000000;

function wrapperType(f: Wrapper, x: Type): Type {
  if (x === 0) return 0;
  switch (f) {
    case 'a':
      return when(has(x, 'B'), T('W')) | (x & T('ghijk')) | (x & T('udfems')) | T('x');
    case 's':
      return when(has(x, 'Bo'), T('W')) | (x & T('ghijk')) | (x & T('udfemsx'));
    case 'c':
      return when(has(x, 'K'), T('B')) | (x & T('ghijk')) | (x & T('ondfem')) | T('us');
    case 'd':
      // En P2WSH, d: no es u: MINIMALIF solo es una regla de política.
      return when(has(x, 'Vz'), T('B')) | when(has(x, 'z'), T('o')) | when(has(x, 'f'), T('e')) | (x & T('ghijk')) | (x & T('ms')) | T('ndx');
    case 'v':
      return when(has(x, 'B'), T('V')) | (x & T('ghijk')) | (x & T('zonms')) | T('fx');
    case 'j':
      return when(has(x, 'Bn'), T('B')) | when(has(x, 'f'), T('e')) | (x & T('ghijk')) | (x & T('oums')) | T('ndx');
    case 'n':
      return (x & T('ghijk')) | (x & T('Bzondfems')) | T('ux');
  }
}

function binaryType(f: 'and_v' | 'and_b' | 'or_b' | 'or_c' | 'or_d' | 'or_i', x: Type, y: Type): Type {
  if (x === 0 || y === 0) return 0;
  const k = (x & y & T('k')) !== 0 && !mixesTimelocks(x, y);
  switch (f) {
    case 'and_v':
      return (
        when(has(x, 'V'), y & T('KVB')) |
        (x & T('n')) |
        when(has(x, 'z'), y & T('n')) |
        when(has(x | y, 'z'), (x | y) & T('o')) |
        (x & y & T('mz')) |
        ((x | y) & T('s')) |
        when(has(y, 'f') || has(x, 's'), T('f')) |
        (y & T('ux')) |
        ((x | y) & T('ghij')) |
        when(k, T('k'))
      );
    case 'and_b':
      return (
        when(has(y, 'W'), x & T('B')) |
        when(has(x | y, 'z'), (x | y) & T('o')) |
        (x & T('n')) |
        when(has(x, 'z'), y & T('n')) |
        when(has(x & y, 's'), x & y & T('e')) |
        (x & y & T('dzm')) |
        when(has(x & y, 'f') || has(x, 'sf') || has(y, 'sf'), T('f')) |
        ((x | y) & T('s')) |
        T('ux') |
        ((x | y) & T('ghij')) |
        when(k, T('k'))
      );
    case 'or_b':
      return (
        when(has(x, 'Bd') && has(y, 'Wd'), T('B')) |
        when(has(x | y, 'z'), (x | y) & T('o')) |
        when(has(x | y, 's') && has(x & y, 'e'), x & y & T('m')) |
        (x & y & T('zse')) |
        T('dux') |
        ((x | y) & T('ghij')) |
        (x & y & T('k'))
      );
    case 'or_d':
      return (
        when(has(x, 'Bdu'), y & T('B')) |
        when(has(y, 'z'), x & T('o')) |
        when(has(x, 'e') && has(x | y, 's'), x & y & T('m')) |
        (x & y & T('zs')) |
        (y & T('ufde')) |
        T('x') |
        ((x | y) & T('ghij')) |
        (x & y & T('k'))
      );
    case 'or_c':
      return (
        when(has(x, 'Bdu'), y & T('V')) |
        when(has(y, 'z'), x & T('o')) |
        when(has(x, 'e') && has(x | y, 's'), x & y & T('m')) |
        (x & y & T('zs')) |
        T('fx') |
        ((x | y) & T('ghij')) |
        (x & y & T('k'))
      );
    case 'or_i':
      return (
        (x & y & T('VBKufs')) |
        when(has(x & y, 'z'), T('o')) |
        when(has(x | y, 'f'), (x | y) & T('e')) |
        when(has(x | y, 's'), x & y & T('m')) |
        ((x | y) & T('d')) |
        T('x') |
        ((x | y) & T('ghij')) |
        (x & y & T('k'))
      );
  }
}

function andorType(x: Type, y: Type, z: Type): Type {
  if (x === 0 || y === 0 || z === 0) return 0;
  const sOrF = has(x, 's') || has(y, 'f');
  const k = (x & y & z & T('k')) !== 0 && !mixesTimelocks(x, y);
  return (
    when(has(x, 'Bdu'), y & z & T('BKV')) |
    (x & y & z & T('z')) |
    when(has(x | (y & z), 'z'), (x | (y & z)) & T('o')) |
    (y & z & T('u')) |
    when(sOrF, z & T('f')) |
    (z & T('d')) |
    when(sOrF, z & T('e')) |
    when(has(x, 'e') && has(x | y | z, 's'), x & y & z & T('m')) |
    (z & (x | y) & T('s')) |
    T('x') |
    ((x | y | z) & T('ghij')) |
    when(k, T('k'))
  );
}

function threshType(k: number, subs: Type[]): Type {
  const n = subs.length;
  if (k < 1 || k > n) return 0;
  let allE = true;
  let allM = true;
  let args = 0;
  let numS = 0;
  let timelocks = T('k');
  for (const [i, t] of subs.entries()) {
    if (!has(t, i === 0 ? 'Bdu' : 'Wdu')) return 0;
    if (!has(t, 'e')) allE = false;
    if (!has(t, 'm')) allM = false;
    if (has(t, 's')) numS++;
    args += has(t, 'z') ? 0 : has(t, 'o') ? 1 : 2;
    const keep = has(timelocks & t, 'k') && (k <= 1 || !mixesTimelocks(timelocks, t));
    timelocks = ((timelocks | t) & T('ghij')) | when(keep, T('k'));
  }
  return (
    T('Bdu') |
    when(args === 0, T('z')) |
    when(args === 1, T('o')) |
    when(allE && numS === n, T('e')) |
    when(allE && allM && numS >= n - k, T('m')) |
    when(numS >= n - k + 1, T('s')) |
    timelocks
  );
}

export interface MiniscriptAnalysis {
  /** Tipos correctos y cabe en un witness script. */
  valid: boolean;
  /** Válida como script completo (tipo B). */
  topLevel: boolean;
  /** Nadie puede cambiar la firma sin invalidarla. */
  nonMalleable: boolean;
  /** Toda forma de gastar pide al menos una firma. */
  needsSignature: boolean;
  /** Mezcla timelocks por altura y por tiempo en una misma rama (alguna forma de gastar no se puede cumplir). */
  timelockMix: boolean;
  duplicateKeys: boolean;
  /** Bytes del witness script. */
  scriptSize: number;
  /** Operaciones que ejecuta la forma de gastar más cara (null si no se puede gastar). */
  ops: number | null;
  /** Elementos del witness de la forma de gastar que más necesita (null si no se puede gastar). */
  stackItems: number | null;
  /** Ninguna forma de gastar pasa de MAX_OPS_PER_SCRIPT ni de MAX_WSH_STACK_ITEMS. */
  withinLimits: boolean;
  /** Lo que exige Bitcoin Core para aceptar un descriptor (IsSane): todo lo anterior en orden. */
  sane: boolean;
}

/** Comprueba una expresión. Las keys se comparan con `keyId` (por defecto, tal cual). */
export function analyzeMiniscript<K>(ms: Miniscript<K>, keyId: (k: K) => unknown = (k) => k): MiniscriptAnalysis {
  const t = miniscriptType(ms);
  const scriptSize = miniscriptScript(ms, () => new Uint8Array(33)).length;
  const valid = t !== 0 && scriptSize <= MAX_WSH_SCRIPT_SIZE;
  const ids = miniscriptKeys(ms).map(keyId);
  const { ops, stack } = limits(ms);
  const opsCount = ops.sat === null ? null : ops.count + ops.sat;
  const stackItems = stack.sat === null ? null : stack.sat.netdiff + (has(t, 'V') ? 0 : 1);
  const a = {
    valid,
    topLevel: valid && has(t, 'B'),
    nonMalleable: valid && has(t, 'm'),
    needsSignature: valid && has(t, 's'),
    timelockMix: valid && !has(t, 'k'),
    duplicateKeys: new Set(ids).size !== ids.length,
    scriptSize,
    ops: opsCount,
    stackItems,
    withinLimits: (opsCount ?? 0) <= MAX_OPS_PER_SCRIPT && (stackItems ?? 0) <= MAX_WSH_STACK_ITEMS,
  };
  return { ...a, sane: a.topLevel && a.withinLimits && a.nonMalleable && a.needsSignature && !a.timelockMix && !a.duplicateKeys };
}

// ---------- Límites ----------

/*
 * Lo que cuesta ejecutar cada forma de gastar, como en Bitcoin Core (CalcOps y CalcStackSize de miniscript.h): para
 * satisfacer (sat) y para descartar (dsat). Null = no hay forma (p. ej., descartar un `v:`); `|` se queda con la peor
 * de las dos formas y `+` las encadena.
 */
type Most = number | null;
const plus = (a: Most, b: Most): Most => (a === null || b === null ? null : a + b);
const worst = (a: Most, b: Most): Most => (a === null ? b : b === null ? a : Math.max(a, b));
interface Ops {
  /** Operaciones fijas del script. */
  count: number;
  /** Las que se añaden al ejecutarlo: las claves de cada CHECKMULTISIG que se ejecuta. */
  sat: Most;
  dsat: Most;
}

/** Efecto en la pila: cuántos elementos quita en total (netdiff) y cuántos más que al final llega a tener (exec). */
type Stack = { netdiff: number; exec: number } | null;
const S = (netdiff: number, exec: number): Stack => ({ netdiff, exec });
const seq = (...parts: Stack[]): Stack =>
  parts.reduce((a, b) => a && b && { netdiff: a.netdiff + b.netdiff, exec: Math.max(b.exec, b.netdiff + a.exec) });
const either = (a: Stack, b: Stack): Stack => (!a ? b : !b ? a : { netdiff: Math.max(a.netdiff, b.netdiff), exec: Math.max(a.exec, b.exec) });
const PUSH = S(-1, 0);
const NOP = S(0, 0);
const POP = S(1, 1); // IF, NOTIF, VERIFY, CHECKSIG, EQUAL y las binarias (BOOLAND, ADD…): quitan uno.
const EQUALVERIFY = S(2, 2);
const ifdup = (nonzero: boolean) => S(nonzero ? -1 : 0, 0);
type Pair = { sat: Stack; dsat: Stack };
const both = (x: Stack): Pair => ({ sat: x, dsat: x });

function limits<K>(ms: Miniscript<K>): { ops: Ops; stack: Pair } {
  const subs = miniscriptChildren(ms).map(limits);
  const [x, y, z] = subs;
  switch (ms.f) {
    case '0':
      return { ops: { count: 0, sat: null, dsat: 0 }, stack: { sat: null, dsat: PUSH } };
    case '1':
      return { ops: { count: 0, sat: 0, dsat: null }, stack: { sat: PUSH, dsat: null } };
    case 'pk_k':
      return { ops: { count: 0, sat: 0, dsat: 0 }, stack: both(PUSH) };
    case 'pk_h':
      return { ops: { count: 3, sat: 0, dsat: 0 }, stack: both(seq(PUSH, NOP, PUSH, EQUALVERIFY)) };
    case 'older':
    case 'after':
      return { ops: { count: 1, sat: 0, dsat: null }, stack: { sat: seq(PUSH, NOP), dsat: null } };
    case 'sha256':
    case 'hash256':
    case 'ripemd160':
    case 'hash160':
      return { ops: { count: 4, sat: 0, dsat: null }, stack: { sat: seq(PUSH, PUSH, EQUALVERIFY, NOP, PUSH, POP), dsat: null } };
    case 'multi':
      // Empieza con k + 1 elementos (un 0 y las firmas), llega a n + k + 3 al empujar las claves, k y n, y acaba con 1.
      return { ops: { count: 1, sat: ms.keys.length, dsat: ms.keys.length }, stack: both(S(ms.k, ms.k + ms.keys.length + 2)) };
    case 'a':
    case 's':
    case 'n':
      return { ops: { ...x!.ops, count: x!.ops.count + (ms.f === 'a' ? 2 : 1) }, stack: x!.stack };
    case 'c':
      return { ops: { ...x!.ops, count: x!.ops.count + 1 }, stack: { sat: seq(x!.stack.sat, POP), dsat: seq(x!.stack.dsat, POP) } };
    case 'd':
      return { ops: { count: x!.ops.count + 3, sat: x!.ops.sat, dsat: 0 }, stack: { sat: seq(PUSH, POP, x!.stack.sat), dsat: seq(PUSH, POP) } };
    case 'j':
      return { ops: { count: x!.ops.count + 4, sat: x!.ops.sat, dsat: 0 }, stack: { sat: seq(PUSH, NOP, POP, x!.stack.sat), dsat: seq(PUSH, NOP, POP) } };
    case 'v':
      return {
        ops: { count: x!.ops.count + (miniscriptHas(ms.x, 'x') ? 1 : 0), sat: x!.ops.sat, dsat: null },
        stack: { sat: seq(x!.stack.sat, POP), dsat: null },
      };
    case 'and_v':
      return { ops: { count: x!.ops.count + y!.ops.count, sat: plus(x!.ops.sat, y!.ops.sat), dsat: null }, stack: { sat: seq(x!.stack.sat, y!.stack.sat), dsat: null } };
    case 'and_b':
      return {
        ops: { count: 1 + x!.ops.count + y!.ops.count, sat: plus(x!.ops.sat, y!.ops.sat), dsat: plus(x!.ops.dsat, y!.ops.dsat) },
        stack: { sat: seq(x!.stack.sat, y!.stack.sat, POP), dsat: seq(x!.stack.dsat, y!.stack.dsat, POP) },
      };
    case 'or_b':
      return {
        ops: {
          count: 1 + x!.ops.count + y!.ops.count,
          sat: worst(plus(x!.ops.sat, y!.ops.dsat), plus(y!.ops.sat, x!.ops.dsat)),
          dsat: plus(x!.ops.dsat, y!.ops.dsat),
        },
        stack: {
          sat: seq(either(seq(x!.stack.sat, y!.stack.dsat), seq(x!.stack.dsat, y!.stack.sat)), POP),
          dsat: seq(x!.stack.dsat, y!.stack.dsat, POP),
        },
      };
    case 'or_d':
      return {
        ops: { count: 3 + x!.ops.count + y!.ops.count, sat: worst(x!.ops.sat, plus(y!.ops.sat, x!.ops.dsat)), dsat: plus(x!.ops.dsat, y!.ops.dsat) },
        stack: {
          sat: either(seq(x!.stack.sat, ifdup(true), POP), seq(x!.stack.dsat, ifdup(false), POP, y!.stack.sat)),
          dsat: seq(x!.stack.dsat, ifdup(false), POP, y!.stack.dsat),
        },
      };
    case 'or_c':
      return {
        ops: { count: 2 + x!.ops.count + y!.ops.count, sat: worst(x!.ops.sat, plus(y!.ops.sat, x!.ops.dsat)), dsat: null },
        stack: { sat: either(seq(x!.stack.sat, POP), seq(x!.stack.dsat, POP, y!.stack.sat)), dsat: null },
      };
    case 'or_i':
      return {
        ops: { count: 3 + x!.ops.count + y!.ops.count, sat: worst(x!.ops.sat, y!.ops.sat), dsat: worst(x!.ops.dsat, y!.ops.dsat) },
        stack: { sat: seq(POP, either(x!.stack.sat, y!.stack.sat)), dsat: seq(POP, either(x!.stack.dsat, y!.stack.dsat)) },
      };
    case 'andor':
      return {
        ops: {
          count: 3 + x!.ops.count + y!.ops.count + z!.ops.count,
          sat: worst(plus(y!.ops.sat, x!.ops.sat), plus(x!.ops.dsat, z!.ops.sat)),
          dsat: plus(x!.ops.dsat, z!.ops.dsat),
        },
        stack: {
          sat: either(seq(x!.stack.sat, POP, y!.stack.sat), seq(x!.stack.dsat, POP, z!.stack.sat)),
          dsat: seq(x!.stack.dsat, POP, z!.stack.dsat),
        },
      };
    case 'thresh': {
      // sats[j]: lo peor entre las formas que satisfacen j de los hijos vistos hasta ahora.
      let count = 0;
      let ops: Most[] = [0];
      let stack: Stack[] = [NOP];
      subs.forEach((sub, i) => {
        count += sub.ops.count + 1;
        const add = i > 0 ? POP : NOP;
        ops = [...ops, null].map((_, j) => worst(j < ops.length ? plus(ops[j]!, sub.ops.dsat) : null, j > 0 ? plus(ops[j - 1]!, sub.ops.sat) : null));
        stack = [...stack, null].map((_, j) =>
          seq(either(j < stack.length ? seq(stack[j]!, sub.stack.dsat) : null, j > 0 ? seq(stack[j - 1]!, sub.stack.sat) : null), add),
        );
      });
      return {
        ops: { count, sat: ops[ms.k] ?? null, dsat: ops[0]! },
        stack: { sat: seq(stack[ms.k] ?? null, PUSH, POP), dsat: seq(stack[0]!, PUSH, POP) },
      };
    }
  }
}

/** Las keys en el orden en que aparecen. */
export function miniscriptKeys<K>(ms: Miniscript<K>): K[] {
  if (ms.f === 'pk_k' || ms.f === 'pk_h') return [ms.key];
  if (ms.f === 'multi') return [...ms.keys];
  return miniscriptChildren(ms).flatMap(miniscriptKeys);
}

export function miniscriptChildren<K>(ms: Miniscript<K>): Miniscript<K>[] {
  if (ms.f === 'thresh') return ms.subs;
  if (ms.f === 'andor') return [ms.x, ms.y, ms.z];
  if ('y' in ms) return [ms.x, ms.y];
  if ('x' in ms) return [ms.x];
  return [];
}

/** La misma expresión con otras keys. */
export function mapMiniscriptKeys<K, L>(ms: Miniscript<K>, f: (k: K) => L): Miniscript<L> {
  const m = (x: Miniscript<K>) => mapMiniscriptKeys(x, f);
  switch (ms.f) {
    case 'pk_k':
    case 'pk_h':
      return { f: ms.f, key: f(ms.key) };
    case 'multi':
      return { f: 'multi', k: ms.k, keys: ms.keys.map(f) };
    case 'thresh':
      return { f: 'thresh', k: ms.k, subs: ms.subs.map(m) };
    case 'andor':
      return { f: 'andor', x: m(ms.x), y: m(ms.y), z: m(ms.z) };
  }
  if ('y' in ms) return { f: ms.f, x: m(ms.x), y: m(ms.y) };
  if ('x' in ms) return { f: ms.f, x: m(ms.x) };
  return ms;
}

// ---------- Escribir ----------

/** Texto de la expresión, con las abreviaturas de Core (pk, pkh, t:, l:, u:, and_n). */
export function miniscriptToString<K>(ms: Miniscript<K>, key: (k: K) => string): string {
  return render(ms, key, false);
}

function render<K>(ms: Miniscript<K>, key: (k: K) => string, wrapped: boolean): string {
  const colon = wrapped ? ':' : '';
  const r = (x: Miniscript<K>) => render(x, key, false);
  const w = (letter: string, x: Miniscript<K>) => letter + render(x, key, true);
  switch (ms.f) {
    case '0':
    case '1':
      return colon + ms.f;
    case 'pk_k':
    case 'pk_h':
      return `${colon}${ms.f}(${key(ms.key)})`;
    case 'older':
    case 'after':
      return `${colon}${ms.f}(${ms.n})`;
    case 'sha256':
    case 'hash256':
    case 'ripemd160':
    case 'hash160':
      return `${colon}${ms.f}(${ms.hash})`;
    case 'multi':
      return `${colon}multi(${[ms.k, ...ms.keys.map(key)].join(',')})`;
    case 'thresh':
      return `${colon}thresh(${[String(ms.k), ...ms.subs.map(r)].join(',')})`;
    case 'andor':
      return ms.z.f === '0' ? `${colon}and_n(${r(ms.x)},${r(ms.y)})` : `${colon}andor(${r(ms.x)},${r(ms.y)},${r(ms.z)})`;
    case 'c':
      if (ms.x.f === 'pk_k' || ms.x.f === 'pk_h') return `${colon}${ms.x.f === 'pk_k' ? 'pk' : 'pkh'}(${key(ms.x.key)})`;
      return w('c', ms.x);
    case 'and_v':
      return ms.y.f === '1' ? w('t', ms.x) : `${colon}and_v(${r(ms.x)},${r(ms.y)})`;
    case 'or_i':
      if (ms.x.f === '0') return w('l', ms.y);
      if (ms.y.f === '0') return w('u', ms.x);
      return `${colon}or_i(${r(ms.x)},${r(ms.y)})`;
  }
  if ('y' in ms) return `${colon}${ms.f}(${r(ms.x)},${r(ms.y)})`;
  return w(ms.f, ms.x);
}

// ---------- Leer ----------

export type MiniscriptProblem =
  | { code: 'syntax' }
  /** Un fragmento que no existe o que no se admite en P2WSH (multi_a, p. ej.). */
  | { code: 'unknown-fragment'; name: string }
  /** Anida más de MAX_MINISCRIPT_DEPTH fragmentos. */
  | { code: 'too-deep' };

export type MiniscriptParseResult = { ok: true; value: Miniscript<string> } | { ok: false; problem: MiniscriptProblem };

/** Divide los argumentos por las comas de primer nivel. */
function splitArgs(s: string): string[] | null {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')' && --depth < 0) return null;
    else if (s[i] === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  if (depth !== 0) return null;
  out.push(s.slice(start));
  return out;
}

class ParseError extends Error {
  constructor(readonly problem: MiniscriptProblem) {
    super(problem.code);
  }
}
const syntax = () => new ParseError({ code: 'syntax' });

const parseNumber = (s: string) => {
  if (!/^(0|[1-9]\d{0,9})$/.test(s)) throw syntax();
  return Number(s);
};

/** Lee una expresión Miniscript (sin `wsh(...)`). Las keys quedan como texto, sin interpretar; los tipos no se comprueban. */
export function parseMiniscript(text: string): MiniscriptParseResult {
  try {
    return { ok: true, value: parseExpr(text) };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, problem: e.problem };
    throw e;
  }
}

/**
 * Anidamiento máximo que se lee. Ningún esquema real se acerca (los de Liana no pasan de diez), pero Core sí acepta
 * una cadena de cien `and_v` (la de 201 operaciones). Sin límite, un texto anidado miles de veces agotaría la pila,
 * aquí y en todo lo que recorre el árbol después: con una pila de 400 KB, como la de un worker modesto, se leen 800.
 */
export const MAX_MINISCRIPT_DEPTH = 150;

function parseExpr(text: string, depth = 0): Miniscript<string> {
  if (depth > MAX_MINISCRIPT_DEPTH) throw new ParseError({ code: 'too-deep' });
  const sub = (t: string) => parseExpr(t, depth + 1);
  const open = text.indexOf('(');
  const head = open < 0 ? text : text.slice(0, open);
  const colon = head.indexOf(':');
  if (colon >= 0) {
    const wrappers = head.slice(0, colon);
    if (wrappers === '' || !/^[asctdvjnlu]+$/.test(wrappers)) throw syntax();
    let inner = sub(text.slice(colon + 1));
    for (const c of [...wrappers].reverse()) {
      if (c === 't') inner = { f: 'and_v', x: inner, y: { f: '1' } };
      else if (c === 'l') inner = { f: 'or_i', x: { f: '0' }, y: inner };
      else if (c === 'u') inner = { f: 'or_i', x: inner, y: { f: '0' } };
      else inner = { f: c as Wrapper, x: inner };
    }
    return inner;
  }
  if (open < 0) {
    if (text === '0' || text === '1') return { f: text };
    throw syntax();
  }
  if (!text.endsWith(')')) throw syntax();
  const args = splitArgs(text.slice(open + 1, -1));
  if (!args || args.some((a) => a === '')) throw syntax();
  const name = head;
  const arity = (n: number) => {
    if (args.length !== n) throw syntax();
  };
  const key = (s: string) => {
    if (/[(),]/.test(s)) throw syntax();
    return s;
  };
  switch (name) {
    case 'pk_k':
    case 'pk_h':
      arity(1);
      return { f: name, key: key(args[0]!) };
    case 'pk':
    case 'pkh':
      arity(1);
      return { f: 'c', x: { f: name === 'pk' ? 'pk_k' : 'pk_h', key: key(args[0]!) } };
    case 'older':
    case 'after':
      arity(1);
      return { f: name, n: parseNumber(args[0]!) };
    case 'sha256':
    case 'hash256':
    case 'ripemd160':
    case 'hash160':
      arity(1);
      if (!/^[0-9a-fA-F]+$/.test(args[0]!)) throw syntax();
      return { f: name, hash: args[0]!.toLowerCase() };
    case 'multi':
      if (args.length < 2) throw syntax();
      return { f: 'multi', k: parseNumber(args[0]!), keys: args.slice(1).map(key) };
    case 'thresh':
      if (args.length < 2) throw syntax();
      return { f: 'thresh', k: parseNumber(args[0]!), subs: args.slice(1).map(sub) };
    case 'andor':
      arity(3);
      return { f: 'andor', x: sub(args[0]!), y: sub(args[1]!), z: sub(args[2]!) };
    case 'and_n':
      arity(2);
      return { f: 'andor', x: sub(args[0]!), y: sub(args[1]!), z: { f: '0' } };
  }
  if (BINARY.has(name)) {
    arity(2);
    return { f: name as 'and_v', x: sub(args[0]!), y: sub(args[1]!) };
  }
  if (WRAPPERS.has(name)) throw syntax();
  throw new ParseError({ code: 'unknown-fragment', name });
}

// ---------- Script ----------

const OP = {
  0: 0x00,
  PUSHDATA1: 0x4c,
  1: 0x51,
  IF: 0x63,
  NOTIF: 0x64,
  ELSE: 0x67,
  ENDIF: 0x68,
  VERIFY: 0x69,
  TOALTSTACK: 0x6b,
  FROMALTSTACK: 0x6c,
  IFDUP: 0x73,
  DUP: 0x76,
  SWAP: 0x7c,
  SIZE: 0x82,
  EQUAL: 0x87,
  EQUALVERIFY: 0x88,
  '0NOTEQUAL': 0x92,
  ADD: 0x93,
  BOOLAND: 0x9a,
  BOOLOR: 0x9b,
  RIPEMD160: 0xa6,
  SHA256: 0xa8,
  HASH160: 0xa9,
  HASH256: 0xaa,
  CHECKSIG: 0xac,
  CHECKMULTISIG: 0xae,
  CHECKLOCKTIMEVERIFY: 0xb1,
  CHECKSEQUENCEVERIFY: 0xb2,
} as const;

/** Una operación del script: un opcode o datos empujados a la pila. */
type Op = { op: number } | { push: Uint8Array };
const op = (code: number): Op => ({ op: code });

/** Número en el formato de la pila (CScriptNum): OP_0, OP_1…OP_16 o los bytes en little-endian con signo. */
function pushNumber(n: number): Op {
  if (n === 0) return op(OP[0]);
  if (n >= 1 && n <= 16) return op(0x50 + n);
  const bytes: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) bytes.push(v % 256);
  if (bytes[bytes.length - 1]! & 0x80) bytes.push(0);
  return { push: Uint8Array.from(bytes) };
}

/** Opcodes que tienen versión «…VERIFY» (v: los sustituye en vez de añadir OP_VERIFY). */
const VERIFY_FORM: ReadonlyMap<number, number> = new Map([
  [OP.CHECKSIG, 0xad],
  [OP.CHECKMULTISIG, 0xaf],
  [OP.EQUAL, OP.EQUALVERIFY],
  [0x9c, 0x9d], // NUMEQUAL
]);

const hashOp: Record<HashFragment, number> = { sha256: OP.SHA256, hash256: OP.HASH256, ripemd160: OP.RIPEMD160, hash160: OP.HASH160 };
const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((b) => Number.parseInt(b, 16)));
const hash160 = (b: Uint8Array) => ripemd160(sha256(b));

function ops<K>(ms: Miniscript<K>, pubkey: (k: K) => Uint8Array): Op[] {
  const o = (x: Miniscript<K>) => ops(x, pubkey);
  switch (ms.f) {
    case '0':
      return [op(OP[0])];
    case '1':
      return [op(OP[1])];
    case 'pk_k':
      return [{ push: pubkey(ms.key) }];
    case 'pk_h':
      return [op(OP.DUP), op(OP.HASH160), { push: hash160(pubkey(ms.key)) }, op(OP.EQUALVERIFY)];
    case 'older':
      return [pushNumber(ms.n), op(OP.CHECKSEQUENCEVERIFY)];
    case 'after':
      return [pushNumber(ms.n), op(OP.CHECKLOCKTIMEVERIFY)];
    case 'sha256':
    case 'hash256':
    case 'ripemd160':
    case 'hash160':
      return [op(OP.SIZE), pushNumber(32), op(OP.EQUALVERIFY), op(hashOp[ms.f]), { push: hex(ms.hash) }, op(OP.EQUAL)];
    case 'multi':
      return [pushNumber(ms.k), ...ms.keys.map((k) => ({ push: pubkey(k) })), pushNumber(ms.keys.length), op(OP.CHECKMULTISIG)];
    case 'a':
      return [op(OP.TOALTSTACK), ...o(ms.x), op(OP.FROMALTSTACK)];
    case 's':
      return [op(OP.SWAP), ...o(ms.x)];
    case 'c':
      return [...o(ms.x), op(OP.CHECKSIG)];
    case 'd':
      return [op(OP.DUP), op(OP.IF), ...o(ms.x), op(OP.ENDIF)];
    case 'v': {
      const inner = o(ms.x);
      const last = inner[inner.length - 1];
      const verify = last && 'op' in last ? VERIFY_FORM.get(last.op) : undefined;
      return verify === undefined ? [...inner, op(OP.VERIFY)] : [...inner.slice(0, -1), op(verify)];
    }
    case 'j':
      return [op(OP.SIZE), op(OP['0NOTEQUAL']), op(OP.IF), ...o(ms.x), op(OP.ENDIF)];
    case 'n':
      return [...o(ms.x), op(OP['0NOTEQUAL'])];
    case 'and_v':
      return [...o(ms.x), ...o(ms.y)];
    case 'and_b':
      return [...o(ms.x), ...o(ms.y), op(OP.BOOLAND)];
    case 'or_b':
      return [...o(ms.x), ...o(ms.y), op(OP.BOOLOR)];
    case 'or_c':
      return [...o(ms.x), op(OP.NOTIF), ...o(ms.y), op(OP.ENDIF)];
    case 'or_d':
      return [...o(ms.x), op(OP.IFDUP), op(OP.NOTIF), ...o(ms.y), op(OP.ENDIF)];
    case 'or_i':
      return [op(OP.IF), ...o(ms.x), op(OP.ELSE), ...o(ms.y), op(OP.ENDIF)];
    case 'andor':
      return [...o(ms.x), op(OP.NOTIF), ...o(ms.z), op(OP.ELSE), ...o(ms.y), op(OP.ENDIF)];
    case 'thresh':
      return [...ms.subs.flatMap((s, i) => (i === 0 ? o(s) : [...o(s), op(OP.ADD)])), pushNumber(ms.k), op(OP.EQUAL)];
  }
}

/** El witness script de la expresión, con la clave pública (comprimida, 33 bytes) de cada key. */
export function miniscriptScript<K>(ms: Miniscript<K>, pubkey: (k: K) => Uint8Array): Uint8Array {
  const bytes: number[] = [];
  for (const o of ops(ms, pubkey)) {
    if ('op' in o) bytes.push(o.op);
    else if (o.push.length < OP.PUSHDATA1) bytes.push(o.push.length, ...o.push);
    else bytes.push(OP.PUSHDATA1, o.push.length, ...o.push);
  }
  return Uint8Array.from(bytes);
}
