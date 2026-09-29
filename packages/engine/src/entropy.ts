import type { CustodyModel, EntropySource, Key } from '@llave-inglesa/domain';

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
