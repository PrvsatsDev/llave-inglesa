import { advisoriesFor, catalogModelByName, type CustodyModel, type EntropySource, type Id, type Key } from '@llave-inglesa/domain';

/**
 * Origen de entropía que un atacante podría comprometer en remoto
 * (RNG defectuoso o con puerta trasera). Dados, moneda y cartas no lo son.
 */
export type EntropyOrigin = { kind: 'vendor'; vendor: string } | { kind: 'unknown' };

const normalize = (vendor: string) => vendor.trim().toLowerCase();

export function originKey(o: EntropyOrigin): string {
  return o.kind === 'unknown' ? 'unknown' : `vendor:${normalize(o.vendor)}`;
}

function sourceOrigin(s: EntropySource): EntropyOrigin | null {
  switch (s.kind) {
    case 'device-rng':
    case 'software-rng':
      return { kind: 'vendor', vendor: s.vendor };
    case 'unknown':
      return { kind: 'unknown' };
    case 'dice':
    case 'coin':
    case 'cards':
      return null;
  }
}

/** Orígenes distintos presentes en el modelo (cada uno es un posible ataque). */
export function entropyOrigins(model: CustodyModel): EntropyOrigin[] {
  const found = new Map<string, EntropyOrigin>();
  const add = (o: EntropyOrigin | null) => {
    if (o && !found.has(originKey(o))) found.set(originKey(o), o);
  };
  for (const key of model.keys) {
    key.provenance.sources.forEach((s) => add(sourceOrigin(s)));
    const gen = key.provenance.generatedBy;
    if (gen) add({ kind: 'vendor', vendor: gen.vendor });
  }
  return [...found.values()];
}

/**
 * ¿Queda expuesta la semilla de `key` si caen los orígenes `compromised` (por originKey)?
 * Devuelve los orígenes responsables, o null si la key resiste.
 *
 * - Si quien generó la semilla está comprometido y no se verificó de forma independiente,
 *   su firmware pudo ignorar el resto de entropía: cae.
 * - Si no, cae solo si TODAS las fuentes están comprometidas (una buena fuente basta).
 */
export function keyCompromise(key: Key, compromised: ReadonlySet<string>): EntropyOrigin[] | null {
  const { generatedBy, independentlyVerified, sources } = key.provenance;
  if (generatedBy && !independentlyVerified) {
    const origin: EntropyOrigin = { kind: 'vendor', vendor: generatedBy.vendor };
    if (compromised.has(originKey(origin))) return [origin];
  }
  const origins = sources.map(sourceOrigin);
  if (origins.every((o) => o !== null && compromised.has(originKey(o)))) {
    const unique = new Map((origins as EntropyOrigin[]).map((o) => [originKey(o), o]));
    return [...unique.values()];
  }
  return null;
}

/** Bits de entropía propia (dados, moneda, cartas) mezclados en la semilla. Sin número de tiradas: 0. */
export function ownEntropyBits(sources: readonly EntropySource[]): number {
  let bits = 0;
  for (const s of sources) {
    if (s.kind !== 'dice' && s.kind !== 'coin' && s.kind !== 'cards') continue;
    const n = s.count ?? 0;
    if (s.kind === 'dice') bits += n * Math.log2(6);
    else if (s.kind === 'coin') bits += n;
    else for (let i = 0; i < Math.min(n, 52); i++) bits += Math.log2(52 - i); // cartas sin reemplazo
  }
  return bits;
}

/**
 * Avisos de entropía débil conocida (p. ej. Coldcard 2026) y las keys que exponen.
 * Cuenta el firmware con el que se GENERÓ la semilla; si no se sabe, se asume afectado.
 * La entropía propia suficiente lo mitiga; la passphrase ya la exige el motor al usar la key.
 */
export function weakEntropyKeys(model: CustodyModel): Map<string, Id[]> {
  const found = new Map<string, Id[]>();
  for (const key of model.keys) {
    const gen = key.provenance.generatedBy;
    const catalog = catalogModelByName(gen?.model);
    if (!gen || !catalog) continue;
    for (const { advisory } of advisoriesFor(catalog.id, gen.firmware)) {
      if (advisory.kind !== 'weak-entropy') continue;
      const mitigated = advisory.mitigations.some((m) => m.type === 'own-entropy' && ownEntropyBits(key.provenance.sources) >= m.minBits);
      if (mitigated) continue;
      found.set(advisory.id, [...(found.get(advisory.id) ?? []), key.id]);
    }
  }
  return found;
}
