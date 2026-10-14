import { analyzeMiniscript, MAX_MULTI_KEYS, miniscriptHas, SEQUENCE_TYPE_FLAG, type Miniscript } from '@llave-inglesa/bitcoin';
import { MAX_OLDER_BLOCKS, type Id, type Policy } from './schema.ts';

/**
 * La política en Miniscript, con formas fijas (no un compilador que optimice): una key es `pk`; k de n keys, `multi`;
 * «todas» encadena `and_v` con cada parte en `v:` (una key, `v:pkh`, como Liana) y la espera al final; «una de»,
 * `or_d` (u `or_i` si la primera no se puede descartar); cualquier otro k de n, `thresh` con los wrappers que pide cada
 * hijo (`s:pk`, `sln:older`, `aln:and_v(…)`). Así sale la herencia simple de Liana:
 * `or_d(multi(k,…),and_v(v:pkh(R),older(N)))`. Null si el resultado no fuera seguro (una rama sin firma, p. ej.).
 */
export function policyMiniscript(policy: Policy): Miniscript<Id> | null {
  const ms = compile(policy);
  return analyzeMiniscript(ms).sane ? ms : null;
}

const B = miniscriptHas;

function compile(p: Policy): Miniscript<Id> {
  if (p.type === 'key') return { f: 'c', x: { f: 'pk_k', key: p.key } };
  if (p.type === 'older') return { f: 'older', n: p.blocks };
  const { k, of } = p;
  if (of.length === 1) return compile(of[0]!);
  const keys = of.flatMap((c) => (c.type === 'key' ? [c.key] : []));
  if (keys.length === of.length && keys.length <= MAX_MULTI_KEYS) return { f: 'multi', k, keys };
  if (k === of.length) return all(of);
  if (k === 1) return any(of);
  return thresh(k, of);
}

/** Todas: and_v(v:X1, and_v(v:X2, …, Xn)), con las esperas al final. */
function all(of: readonly Policy[]): Miniscript<Id> {
  const ordered = [...of.filter((c) => c.type !== 'older'), ...of.filter((c) => c.type === 'older')];
  const verify = (c: Policy): Miniscript<Id> => ({ f: 'v', x: c.type === 'key' ? { f: 'c', x: { f: 'pk_h', key: c.key } } : compile(c) });
  return ordered.slice(0, -1).reduceRight<Miniscript<Id>>((acc, c) => ({ f: 'and_v', x: verify(c), y: acc }), compile(ordered[ordered.length - 1]!));
}

/** Una de: or_d(X1, or_d(X2, …)); primero las que se pueden descartar sin firmar (du), que es lo que pide or_d. */
function any(of: readonly Policy[]): Miniscript<Id> {
  const parts = of.map(compile);
  const ordered = [...parts.filter((x) => B(x, 'du')), ...parts.filter((x) => !B(x, 'du'))];
  return ordered
    .slice(0, -1)
    .reduceRight<Miniscript<Id>>((acc, x) => (B(x, 'du') ? { f: 'or_d', x, y: acc } : { f: 'or_i', x, y: acc }), ordered[ordered.length - 1]!);
}

function thresh(k: number, of: readonly Policy[]): Miniscript<Id> {
  const parts = of.map(compile).map(toBdu);
  return { f: 'thresh', k, subs: parts.map((x, i) => (i === 0 ? x : toW(x))) };
}

/** Bdu: n: si no deja un 1 exacto, y l: (or_i(0,X)) si no se puede descartar. */
function toBdu(x: Miniscript<Id>): Miniscript<Id> {
  const u = B(x, 'u') ? x : { f: 'n' as const, x };
  return B(u, 'd') ? u : { f: 'or_i', x: { f: '0' }, y: u };
}

/** W: s: si consume un solo elemento de la pila, a: si no. */
const toW = (x: Miniscript<Id>): Miniscript<Id> => (B(x, 'o') ? { f: 's', x } : { f: 'a', x });

// ---------- Del Miniscript a la política ----------

type Lifted<K> = Policy<K> | true | false;

/**
 * La política que expresa un Miniscript, con sus mismas keys: lo que importa es quién firma y cuándo, no cómo se
 * escribe (`and_v`, `and_b`, `andor`… son «y», `or_*` es «o», los wrappers no cuentan). Una cadena de «y» o de «o»
 * binarios (`and_v(X, and_v(Y, Z))`) es un solo «todas» o «una de»; un `multi` o un `thresh` se queda como está. Las
 * esperas van detrás de las keys. Null si usa algo que el modelo no tiene: timelocks absolutos (`after`) o por
 * tiempo, hashes, esperas de más de MAX_OLDER_BLOCKS.
 */
export function miniscriptPolicy<K>(ms: Miniscript<K>): Policy<K> | null {
  const p = lift(ms);
  return p === null || typeof p === 'boolean' ? null : p;
}

const AND = new Set(['and_v', 'and_b']);
const OR = new Set(['or_b', 'or_c', 'or_d', 'or_i']);
const TRANSPARENT = new Set(['a', 's', 'd', 'v', 'j', 'n']);

/** Los operandos de una cadena de fragmentos de la misma familia, atravesando los wrappers. */
function operands<K>(ms: Miniscript<K>, family: ReadonlySet<string>): Miniscript<K>[] {
  if (TRANSPARENT.has(ms.f) && 'x' in ms) return operands(ms.x, family);
  if (family.has(ms.f) && 'y' in ms) return [...operands(ms.x, family), ...operands(ms.y, family)];
  return [ms];
}

function lift<K>(ms: Miniscript<K>): Lifted<K> | null {
  switch (ms.f) {
    case '0':
      return false;
    case '1':
      return true;
    case 'pk_k':
    case 'pk_h':
      return { type: 'key', key: ms.key };
    case 'older':
      return (ms.n & SEQUENCE_TYPE_FLAG) === 0 && ms.n <= MAX_OLDER_BLOCKS ? { type: 'older', blocks: ms.n } : null;
    case 'after':
    case 'sha256':
    case 'hash256':
    case 'ripemd160':
    case 'hash160':
      return null;
    case 'multi':
      return threshOf(ms.k, ms.keys.map((key) => ({ type: 'key', key })));
    case 'thresh':
      return threshOf(ms.k, ms.subs.map(lift));
    case 'andor':
      return threshOf(1, [threshOf(2, [lift(ms.x), lift(ms.y)]), lift(ms.z)]);
    case 'and_v':
    case 'and_b': {
      const parts = operands(ms, AND).map(lift);
      return threshOf(parts.length, parts);
    }
    case 'or_b':
    case 'or_c':
    case 'or_d':
    case 'or_i':
      return threshOf(1, operands(ms, OR).map(lift));
  }
  return lift(ms.x);
}

/** k de los hijos, quitando los que siempre se cumplen (cuentan como uno ya hecho) o nunca. */
function threshOf<K>(k: number, children: readonly (Lifted<K> | null)[]): Lifted<K> | null {
  if (children.some((c) => c === null)) return null;
  const known = children as Lifted<K>[];
  const need = k - known.filter((c) => c === true).length;
  const rest = known.filter((c): c is Policy<K> => typeof c !== 'boolean');
  if (need <= 0) return true;
  if (need > rest.length) return false;
  if (rest.length === 1) return rest[0]!;
  const rank = (c: Policy<K>) => (c.type === 'key' ? 0 : c.type === 'thresh' ? 1 : 2);
  return { type: 'thresh', k: need, of: [...rest].sort((a, b) => rank(a) - rank(b)) };
}
