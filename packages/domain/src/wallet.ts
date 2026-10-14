import {
  isMultisigScript,
  mapMiniscriptKeys,
  MAX_MULTISIG_KEYS,
  miniscriptKeys,
  parseXpub,
  type Descriptor,
  type DescriptorKey,
  type Network,
  type ParsedDescriptor,
  type ScriptType,
} from '@llave-inglesa/bitcoin';
import { miniscriptPolicy, policyMiniscript } from './miniscript.ts';
import type { CustodyModel, Id, Key, Wallet } from './schema.ts';
import { policyShape, shapeKeys, type PolicyShape } from './shape.ts';

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
 * Las keys del descriptor, en su orden: las de la política plana, o las del Miniscript en el orden en que aparecen.
 * Null si la política no se puede escribir.
 */
export function walletKeyIds(model: CustodyModel): Id[] | null {
  const flat = flatPolicy(model);
  if (flat) return flat.kind === 'single' ? [flat.key] : flat.keys;
  const miniscript = policyMiniscript(model.policy);
  return miniscript && miniscriptKeys(miniscript);
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
  const miniscript = flat ? null : policyMiniscript(model.policy);
  if (!flat && !miniscript) return { ok: false, problems: [{ code: 'no-miniscript' }] };
  const wallet = walletOf(model);
  const problems: WalletProblem[] = [];
  // Con Miniscript, las keys en el orden en que aparecen: su índice es el de la key en el descriptor.
  const ids = miniscript ? miniscriptKeys(miniscript) : flat!.kind === 'single' ? [flat!.key] : flat!.keys;
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

  const descriptorKeys = valid.map(({ key, xpub }): DescriptorKey => ({
    xpub: xpub.xpub,
    ...(key.fingerprint !== undefined && { fingerprint: key.fingerprint.toLowerCase() }),
    ...(key.derivation !== undefined && { path: key.derivation }),
  }));
  const noOrigin = keys.filter((k) => k.fingerprint === undefined || k.derivation === undefined).map((k) => k.id);
  const descriptor: Descriptor = miniscript
    ? { script: 'wsh', sorted: false, keys: descriptorKeys, miniscript: mapMiniscriptKeys(miniscript, (id) => ids.indexOf(id)) }
    : { script: wallet.script, sorted: wallet.sorted, keys: descriptorKeys, ...(flat!.kind === 'multi' && { threshold: flat!.k }) };
  return { ok: true, descriptor, network: [...networks][0]!, warnings: noOrigin.length > 0 ? [{ code: 'missing-origin', keys: noOrigin }] : [] };
}

export type ImportProblem =
  /** La política del esquema no es ninguna de las plantillas: no hay con qué comparar el descriptor. */
  | { code: 'model-policy' }
  /** El descriptor no es ninguna de las plantillas, o usa algo que el modelo no tiene (timelocks absolutos, hashes…). */
  | { code: 'descriptor-policy' }
  /** El descriptor y el esquema no tienen la misma forma: k de n distintos, o single-sig frente a multisig. */
  | { code: 'shape-mismatch'; descriptor: { k: number; n: number }; model: { k: number; n: number } }
  /** Lo mismo con una forma con espera: otra plantilla, otro umbral, otro número de keys u otra espera. */
  | { code: 'policy-mismatch'; descriptor: PolicyShape; model: PolicyShape }
  /** Una key del esquema tiene un fingerprint que no aparece en el descriptor. */
  | { code: 'fingerprint-not-found'; key: Id };

/** Cómo se emparejó cada key del descriptor con una del esquema. Por orden solo cuando la key no tenía nada con que comparar. */
export type Match = { key: Id; by: 'xpub' | 'fingerprint' | 'order' };

export type ImportResult = { ok: true; model: CustodyModel; matches: Match[] } | { ok: false; problem: ImportProblem };

/** Grupos de keys intercambiables: las del esquema y los índices de las del descriptor que pueden ser ellas. */
type KeyGroup = { keys: Id[]; indices: number[] };

/**
 * Rellena las keys del esquema con lo que trae un descriptor (xpub, fingerprint, derivación) y guarda su tipo de script.
 * Empareja por xpub, luego por fingerprint, y las que no tienen ninguno de los dos, por orden de la política. Con
 * Miniscript, solo dentro de cada papel (las principales con las principales, la de recuperación con la suya). No
 * cambia la política: si el descriptor es de otra forma, lo dice.
 */
export function importDescriptor(model: CustodyModel, parsed: ParsedDescriptor): ImportResult {
  const groups = parsed.descriptor.miniscript ? miniscriptGroups(model, parsed.descriptor) : flatGroups(model, parsed.descriptor);
  if (!Array.isArray(groups)) return { ok: false, problem: groups };
  const { descriptor } = parsed;

  const assigned = new Map<Id, { index: number; by: Match['by'] }>();
  for (const group of groups) {
    const keys = group.keys.map((id) => model.keys.find((k) => k.id === id)!);
    const pending = new Set(group.indices);
    const take = (key: Key, by: Match['by'], test: (d: DescriptorKey) => boolean) => {
      const index = [...pending].find((i) => test(descriptor.keys[i]!));
      if (index === undefined) return;
      pending.delete(index);
      assigned.set(key.id, { index, by });
    };
    for (const key of keys) if (key.xpub) take(key, 'xpub', (d) => d.xpub === key.xpub);
    for (const key of keys) {
      if (!assigned.has(key.id) && key.fingerprint) take(key, 'fingerprint', (d) => d.fingerprint === key.fingerprint!.toLowerCase());
    }
    const unmatchedWithFingerprint = keys.find((k) => !assigned.has(k.id) && k.fingerprint !== undefined);
    if (unmatchedWithFingerprint) return { ok: false, problem: { code: 'fingerprint-not-found', key: unmatchedWithFingerprint.id } };
    for (const key of keys) if (!assigned.has(key.id)) take(key, 'order', () => true);
  }

  const updated = model.keys.map((k): Key => {
    const a = assigned.get(k.id);
    if (!a) return k;
    const d = descriptor.keys[a.index]!;
    // Lo que el descriptor no trae (un origen sin fingerprint, p. ej.) se conserva.
    return { ...k, xpub: d.xpub, ...(d.fingerprint !== undefined && { fingerprint: d.fingerprint }), ...(d.path !== undefined && { derivation: d.path }) };
  });
  const wallet: Wallet = { script: descriptor.script as ScriptType, sorted: descriptor.sorted };
  return {
    ok: true,
    model: { ...model, keys: updated, wallet },
    matches: groups.flatMap((g) => g.keys).map((id) => ({ key: id, by: assigned.get(id)!.by })),
  };
}

/** Descriptor clásico: una sola forma, k de n (o single-sig), con todas las keys intercambiables. */
function flatGroups(model: CustodyModel, descriptor: Descriptor): KeyGroup[] | ImportProblem {
  const flat = flatPolicy(model);
  if (!flat) {
    const shape = policyShape(model.policy);
    if (!shape) return { code: 'model-policy' };
    const k = isMultisigScript(descriptor.script) ? descriptor.threshold! : 1;
    return { code: 'policy-mismatch', descriptor: { kind: 'plain', k, keys: descriptor.keys.map((_, i) => String(i)) }, model: shape };
  }
  const shape = (multi: boolean, k: number, n: number) => ({ k: multi ? k : 1, n });
  const fromDescriptor = shape(isMultisigScript(descriptor.script), descriptor.threshold ?? 1, descriptor.keys.length);
  const ids = flat.kind === 'single' ? [flat.key] : flat.keys;
  const fromModel = shape(flat.kind === 'multi', flat.kind === 'multi' ? flat.k : 1, ids.length);
  const sameKind = isMultisigScript(descriptor.script) === (flat.kind === 'multi');
  if (!sameKind || fromDescriptor.k !== fromModel.k || fromDescriptor.n !== fromModel.n) {
    return { code: 'shape-mismatch', descriptor: fromDescriptor, model: fromModel };
  }
  return [{ keys: ids, indices: descriptor.keys.map((_, i) => i) }];
}

/** wsh(miniscript): las dos políticas tienen que ser la misma plantilla, con el mismo umbral, keys y espera. */
function miniscriptGroups(model: CustodyModel, descriptor: Descriptor): KeyGroup[] | ImportProblem {
  const lifted = miniscriptPolicy(mapMiniscriptKeys(descriptor.miniscript!, String));
  const fromDescriptor = lifted && policyShape(lifted);
  if (!fromDescriptor) return { code: 'descriptor-policy' };
  const fromModel = policyShape(model.policy);
  if (!fromModel) return { code: 'model-policy' };
  const blocks = (s: PolicyShape) => (s.kind === 'plain' ? 0 : s.blocks);
  const same =
    fromDescriptor.kind === fromModel.kind &&
    fromDescriptor.k === fromModel.k &&
    fromDescriptor.keys.length === fromModel.keys.length &&
    shapeKeys(fromDescriptor).length === shapeKeys(fromModel).length &&
    blocks(fromDescriptor) === blocks(fromModel);
  if (!same) return { code: 'policy-mismatch', descriptor: fromDescriptor, model: fromModel };
  const special = (s: PolicyShape) => (s.kind === 'inheritance' ? [s.recovery] : s.kind === 'expanding' ? [s.extra] : []);
  const groups: KeyGroup[] = [{ keys: fromModel.keys, indices: fromDescriptor.keys.map(Number) }];
  if (special(fromModel).length > 0) groups.push({ keys: special(fromModel), indices: special(fromDescriptor).map(Number) });
  return groups;
}

/** Cambia cómo se escribe la cartera (tipo de script, sortedmulti o multi). */
export function setWallet(model: CustodyModel, wallet: Wallet): CustodyModel {
  return { ...model, wallet };
}
