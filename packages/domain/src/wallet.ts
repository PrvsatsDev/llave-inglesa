import {
  analyzeMiniscript,
  isMultisigScript,
  mapMiniscriptKeys,
  MAX_MULTISIG_KEYS,
  miniscriptKeys,
  parseXpub,
  type Descriptor,
  type DescriptorKey,
  type Miniscript,
  type Network,
  type ParsedDescriptor,
  type ScriptType,
} from '@llave-inglesa/bitcoin';
import { keyUseId, keyUsesText, miniscriptPolicy, parseKeyUses, policyMiniscript, samePolicy, withPairs, type KeyUse } from './miniscript.ts';
import { addKey } from './edit.ts';
import { mapPolicyKeys, policyKeys } from './model-index.ts';
import type { CustodyModel, Id, Key, Policy, Wallet } from './schema.ts';

/**
 * La política como descriptor clásico: una key sola (single-sig) o un umbral k de n de keys (multisig). Null si
 * necesita Miniscript (umbrales anidados o esperas).
 */
export type FlatPolicy = { kind: 'single'; key: Id } | { kind: 'multi'; k: number; keys: Id[] };

export function flatPolicy(model: CustodyModel): FlatPolicy | null {
  const p = model.policy;
  if (p.type === 'key') return { kind: 'single', key: p.key };
  if (p.type === 'older') return null;
  const keys = p.of.map((c) => (c.type === 'key' ? c.key : null));
  return keys.every((k): k is Id => k !== null) ? { kind: 'multi', k: p.k, keys } : null;
}

/**
 * El tipo de script elegido, o el habitual para la política: wsh si es multisig, wpkh si es single-sig. Con Miniscript,
 * siempre wsh (y sin sortedmulti, que Miniscript no tiene).
 */
export function walletOf(model: CustodyModel): Wallet {
  const flat = flatPolicy(model);
  if (!flat) return { script: 'wsh', sorted: false };
  return model.wallet ?? { script: flat.kind === 'single' ? 'wpkh' : 'wsh', sorted: true };
}

/**
 * El Miniscript de la cartera, con el par de ramas de cada aparición de una key: el del descriptor importado mientras
 * la política sea la misma (así da las mismas direcciones que la cartera de la que vino), o el que se escribe aquí.
 * Null si la política es un descriptor clásico o no se puede escribir en Miniscript.
 */
export function walletMiniscript(model: CustodyModel): Miniscript<KeyUse> | null {
  if (flatPolicy(model)) return null;
  const stored = model.wallet?.miniscript === undefined ? null : parseKeyUses(model.wallet.miniscript);
  if (stored && analyzeMiniscript(stored, keyUseId).sane) {
    const lifted = miniscriptPolicy(mapMiniscriptKeys(stored, (u) => u.key));
    if (lifted && samePolicy(lifted, model.policy)) return stored;
  }
  const ms = policyMiniscript(model.policy);
  return ms && withPairs(ms);
}

/**
 * Las keys del descriptor, una vez cada una: las de la política plana, o las del Miniscript en el orden en que
 * aparecen. Null si la política no se puede escribir.
 */
export function walletKeyIds(model: CustodyModel): Id[] | null {
  const flat = flatPolicy(model);
  if (flat) return flat.kind === 'single' ? [flat.key] : flat.keys;
  const miniscript = walletMiniscript(model);
  return miniscript && [...new Set(miniscriptKeys(miniscript).map((u) => u.key))];
}

export type WalletProblem =
  /** La política no se puede escribir en Miniscript de forma segura: repite una key, una rama no pide firma… */
  | { code: 'no-miniscript' }
  /** Un script single-sig con una política multisig, o al revés. */
  | { code: 'script-mismatch' }
  | { code: 'too-many-keys' }
  /** Keys de la política sin xpub todavía. */
  | { code: 'missing-xpub'; keys: Id[] }
  /** La xpub guardada no es válida (fichero editado a mano). */
  | { code: 'invalid-xpub'; keys: Id[] }
  | { code: 'duplicate-xpub'; keys: Id[] }
  /** Unas xpub de mainnet y otras de testnet. */
  | { code: 'mixed-networks' };

/** Avisos que no impiden escribir el descriptor pero sí firmar con él: los dispositivos necesitan el origen de cada key. */
export type WalletWarning = { code: 'missing-origin'; keys: Id[] };

export type WalletDescriptorResult =
  | { ok: true; descriptor: Descriptor; network: Network; warnings: WalletWarning[] }
  | { ok: false; problems: WalletProblem[] };

/** Construye el descriptor de la cartera a partir del esquema, o explica qué falta. Puro. */
export function walletDescriptor(model: CustodyModel): WalletDescriptorResult {
  const flat = flatPolicy(model);
  const miniscript = flat ? null : walletMiniscript(model);
  if (!flat && !miniscript) return { ok: false, problems: [{ code: 'no-miniscript' }] };
  const wallet = walletOf(model);
  const problems: WalletProblem[] = [];
  const ids = walletKeyIds(model)!;
  if (flat && isMultisigScript(wallet.script) !== (flat.kind === 'multi')) problems.push({ code: 'script-mismatch' });
  if (flat && ids.length > MAX_MULTISIG_KEYS) problems.push({ code: 'too-many-keys' });

  const keys = ids.map((id) => model.keys.find((k) => k.id === id)).filter((k): k is Key => k !== undefined);
  const missing = keys.filter((k) => k.xpub === undefined).map((k) => k.id);
  if (missing.length > 0) problems.push({ code: 'missing-xpub', keys: missing });
  const parsed = keys.flatMap((k) => (k.xpub === undefined ? [] : [{ key: k, result: parseXpub(k.xpub) }]));
  const invalid = parsed.filter((p) => !p.result.ok).map((p) => p.key.id);
  if (invalid.length > 0) problems.push({ code: 'invalid-xpub', keys: invalid });
  const valid = parsed.flatMap((p) => (p.result.ok ? [{ key: p.key, xpub: p.result.value }] : []));
  const duplicated = valid.filter((v) => valid.some((w) => w !== v && w.xpub.xpub === v.xpub.xpub)).map((v) => v.key.id);
  if (duplicated.length > 0) problems.push({ code: 'duplicate-xpub', keys: duplicated });
  const networks = new Set(valid.map((v) => v.xpub.network));
  if (networks.size > 1) problems.push({ code: 'mixed-networks' });
  if (problems.length > 0) return { ok: false, problems };

  const descriptorKey = new Map(
    valid.map(({ key, xpub }): [Id, DescriptorKey] => [
      key.id,
      {
        xpub: xpub.xpub,
        ...(key.fingerprint !== undefined && { fingerprint: key.fingerprint.toLowerCase() }),
        ...(key.derivation !== undefined && { path: key.derivation }),
      },
    ]),
  );
  const noOrigin = keys.filter((k) => k.fingerprint === undefined || k.derivation === undefined).map((k) => k.id);
  // Con Miniscript, una key del descriptor por cada aparición (con su par de ramas), en el orden en que aparecen.
  let next = 0;
  const descriptor: Descriptor = miniscript
    ? {
        script: 'wsh',
        sorted: false,
        keys: miniscriptKeys(miniscript).map((u) => ({ ...descriptorKey.get(u.key)!, ...(u.pair > 0 && { multipath: u.pair }) })),
        miniscript: mapMiniscriptKeys(miniscript, () => next++),
      }
    : { script: wallet.script, sorted: wallet.sorted, keys: ids.map((id) => descriptorKey.get(id)!), ...(flat!.kind === 'multi' && { threshold: flat!.k }) };
  return { ok: true, descriptor, network: [...networks][0]!, warnings: noOrigin.length > 0 ? [{ code: 'missing-origin', keys: noOrigin }] : [] };
}

export type ImportProblem =
  /** El descriptor usa algo que el modelo no tiene: timelocks absolutos (after) o por tiempo, hashes… */
  | { code: 'descriptor-policy' }
  /** Las políticas no dicen lo mismo (otro umbral, otras keys, otra espera…). Las keys del descriptor, por su índice. */
  | { code: 'policy-mismatch'; descriptor: Policy<number>; model: Policy }
  /** Una key del esquema tiene un fingerprint que no aparece en el descriptor (en su papel). */
  | { code: 'fingerprint-not-found'; key: Id };

/** Cómo se emparejó cada key del descriptor con una del esquema. Por orden solo cuando la key no tenía nada con que comparar. */
export type Match = { key: Id; by: 'xpub' | 'fingerprint' | 'order' };

export type ImportResult = { ok: true; model: CustodyModel; matches: Match[] } | { ok: false; problem: ImportProblem };

/**
 * La política que expresa un descriptor, con cada key como su índice en `keys`. Una xpub que se repite con otro par
 * de ramas (`<2;3>`) es la misma key: cuenta el índice de su primera aparición. Null si usa algo que el modelo no tiene.
 */
export function descriptorPolicy(d: Descriptor): Policy<number> | null {
  const first = (i: number) => d.keys.findIndex((k) => k.xpub === d.keys[i]!.xpub);
  if (d.miniscript) return miniscriptPolicy(mapMiniscriptKeys(d.miniscript, first));
  const keys = d.keys.map((_, i): Policy<number> => ({ type: 'key', key: i }));
  return isMultisigScript(d.script) && keys.length > 1 ? { type: 'thresh', k: d.threshold!, of: keys } : keys[0]!;
}

/**
 * Rellena las keys del esquema con lo que trae un descriptor (xpub, fingerprint, derivación) y guarda cómo se escribe
 * (tipo de script y, con Miniscript, el script tal cual, para dar las mismas direcciones). La política del descriptor
 * tiene que decir lo mismo que la del esquema, aunque esté escrita de otra forma; las keys se emparejan respetando su
 * papel en ella: por xpub, luego por fingerprint y, las que no tienen ninguno de los dos, por orden. No cambia la
 * política: si no es la misma, lo dice (y `adoptDescriptorPolicy` la cambia).
 */
export function importDescriptor(model: CustodyModel, parsed: ParsedDescriptor): ImportResult {
  const { descriptor } = parsed;
  const fromDescriptor = descriptorPolicy(descriptor);
  if (!fromDescriptor) return { ok: false, problem: { code: 'descriptor-policy' } };
  const pairing = pairKeys(model, descriptor, fromDescriptor);
  if (!pairing) return { ok: false, problem: { code: 'policy-mismatch', descriptor: fromDescriptor, model: model.policy } };
  const { assigned } = pairing;

  const byKey = new Map(model.keys.map((k) => [k.id, k]));
  const mismatched = [...assigned].find(([id, a]) => a.by === 'order' && byKey.get(id)!.fingerprint !== undefined);
  if (mismatched) return { ok: false, problem: { code: 'fingerprint-not-found', key: mismatched[0] } };

  const updated = model.keys.map((k): Key => {
    const a = assigned.get(k.id);
    if (!a) return k;
    const d = descriptor.keys[a.index]!;
    // Lo que el descriptor no trae (un origen sin fingerprint, p. ej.) se conserva.
    return { ...k, xpub: d.xpub, ...(d.fingerprint !== undefined && { fingerprint: d.fingerprint }), ...(d.path !== undefined && { derivation: d.path }) };
  });
  const keyAt = new Map([...assigned].map(([id, a]) => [a.index, id]));
  const first = (i: number) => descriptor.keys.findIndex((k) => k.xpub === descriptor.keys[i]!.xpub);
  let policy = model.policy;
  let wallet: Wallet;
  if (descriptor.miniscript) {
    const uses = mapMiniscriptKeys(descriptor.miniscript, (i): KeyUse => ({ key: keyAt.get(first(i))!, pair: descriptor.keys[i]!.multipath ?? 0 }));
    wallet = { script: 'wsh', sorted: false, miniscript: keyUsesText(uses) };
  } else {
    wallet = { script: descriptor.script as ScriptType, sorted: descriptor.sorted };
    // Con multi (sin ordenar), el orden de las keys cambia el script: el del descriptor.
    if (!descriptor.sorted && policy.type === 'thresh') policy = { ...policy, of: descriptor.keys.map((_, i) => ({ type: 'key', key: keyAt.get(i)! })) };
  }
  return {
    ok: true,
    model: { ...model, keys: updated, policy, wallet },
    matches: policyKeys(model.policy).map((id) => ({ key: id, by: assigned.get(id)!.by })),
  };
}

type Assigned = Map<Id, { index: number; by: Match['by'] }>;

/** Cuántas combinaciones de keys se prueban, como mucho, antes de dar las políticas por distintas. */
const MAX_PAIRINGS = 20_000;

/**
 * Empareja cada key de la política del esquema con una del descriptor de forma que las dos políticas digan lo mismo.
 * Cada key prueba primero la del descriptor con su xpub, luego la de su fingerprint y luego las demás, en orden; solo
 * entre las que ocupan el mismo sitio en la política. Null si no hay forma.
 */
function pairKeys(model: CustodyModel, descriptor: Descriptor, fromDescriptor: Policy<number>): { assigned: Assigned } | null {
  const ids = policyKeys(model.policy);
  const indices = policyKeys(fromDescriptor);
  if (ids.length !== indices.length) return null;
  const roleOfId = roles(model.policy);
  const roleOfIndex = roles(fromDescriptor);
  const byKey = new Map(model.keys.map((k) => [k.id, k]));
  const how = (id: Id, i: number): Match['by'] => {
    const key = byKey.get(id)!;
    const d = descriptor.keys[i]!;
    if (key.xpub !== undefined && key.xpub === d.xpub) return 'xpub';
    if (key.fingerprint !== undefined && key.fingerprint.toLowerCase() === d.fingerprint) return 'fingerprint';
    return 'order';
  };
  const rank = { xpub: 0, fingerprint: 1, order: 2 };
  // Primero las keys con algo con que comparar, para que no les quite su pareja una que va por orden.
  const order = [...ids].sort((a, b) => Number(byKey.get(b)!.xpub !== undefined) - Number(byKey.get(a)!.xpub !== undefined) || Number(byKey.get(b)!.fingerprint !== undefined) - Number(byKey.get(a)!.fingerprint !== undefined));
  const candidates = new Map(
    order.map((id) => [id, indices.filter((i) => roleOfIndex.get(i) === roleOfId.get(id)).sort((a, b) => rank[how(id, a)] - rank[how(id, b)])]),
  );
  const chosen = new Map<Id, number>();
  const used = new Set<number>();
  let tries = 0;
  const search = (n: number): boolean => {
    if (n === order.length) {
      tries++;
      const back = new Map([...chosen].map(([id, i]) => [i, id]));
      return samePolicy(mapPolicyKeys(fromDescriptor, (i) => back.get(i)!), model.policy);
    }
    const id = order[n]!;
    for (const i of candidates.get(id)!) {
      if (used.has(i) || tries >= MAX_PAIRINGS) continue;
      chosen.set(id, i);
      used.add(i);
      if (search(n + 1)) return true;
      used.delete(i);
    }
    chosen.delete(id);
    return false;
  };
  if (!search(0)) return null;
  return { assigned: new Map([...chosen].map(([id, i]) => [id, { index: i, by: how(id, i) }])) };
}

/**
 * El sitio de cada key en la política, sin mirar qué keys hay: los umbrales (y esperas) de los grupos por los que se
 * llega a ella. Dos keys intercambiables tienen el mismo; si no, no pueden ser la misma en las dos políticas.
 */
function roles<K>(policy: Policy<K>): Map<K, string> {
  const paths = new Map<K, string[]>();
  const walk = (p: Policy<K>, path: string) => {
    if (p.type === 'key') paths.set(p.key, [...(paths.get(p.key) ?? []), path]);
    if (p.type !== 'thresh') return;
    const waits = p.of.flatMap((c) => (c.type === 'older' ? [c.blocks] : [])).sort((a, b) => a - b);
    for (const c of p.of) walk(c, `${path}>${p.k}/${p.of.length}:${waits.join(',')}`);
  };
  walk(policy, '');
  return new Map([...paths].map(([k, ps]) => [k, ps.sort().join('|')]));
}

/**
 * Cambia la política del esquema por la del descriptor y lo importa. Las keys del descriptor se emparejan con las del
 * esquema por xpub, luego por fingerprint y luego por orden; si faltan, se crean (K4, K5…). Las del esquema que
 * sobran se quedan fuera de la política, sin borrarlas. Null si el descriptor usa algo que el modelo no tiene.
 */
export function adoptDescriptorPolicy(model: CustodyModel, parsed: ParsedDescriptor): ImportResult | null {
  const { descriptor } = parsed;
  const fromDescriptor = descriptorPolicy(descriptor);
  if (!fromDescriptor) return null;
  const indices = policyKeys(fromDescriptor);
  const keyFor = new Map<number, Id>();
  const free = (k: Key) => ![...keyFor.values()].includes(k.id);
  const take = (test: (k: Key, d: DescriptorKey) => boolean) => {
    for (const i of indices) {
      const key = keyFor.has(i) ? undefined : model.keys.find((k) => free(k) && test(k, descriptor.keys[i]!));
      if (key) keyFor.set(i, key.id);
    }
  };
  take((k, d) => k.xpub === d.xpub);
  take((k, d) => k.fingerprint !== undefined && k.fingerprint.toLowerCase() === d.fingerprint);
  take((k) => k.xpub === undefined && k.fingerprint === undefined);
  let next = model;
  for (const i of indices) {
    if (keyFor.has(i)) continue;
    const created = addKey(next);
    next = created.model;
    keyFor.set(i, created.id);
  }
  return importDescriptor({ ...next, policy: mapPolicyKeys(fromDescriptor, (i) => keyFor.get(i)!) }, parsed);
}

/** Cambia cómo se escribe la cartera (tipo de script, sortedmulti o multi). */
export function setWallet(model: CustodyModel, wallet: Wallet): CustodyModel {
  return { ...model, wallet };
}
