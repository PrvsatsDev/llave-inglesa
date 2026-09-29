import type { EntropySource, Key, Policy } from '@llave-inglesa/domain';

/** Textos de presentación en español para la web. */

export function policyText(policy: Policy, label: (id: string) => string): string {
  if (policy.type === 'key') return label(policy.key);
  const allKeys = policy.of.every((p) => p.type === 'key');
  return allKeys ? `${policy.k} de ${policy.of.length}` : `${policy.k} de ${policy.of.length} (${policy.of.map((p) => policyText(p, label)).join(', ')})`;
}

function sourceText(s: EntropySource): string {
  const count = 'count' in s && s.count ? ` ×${s.count}` : '';
  switch (s.kind) {
    case 'device-rng':
    case 'software-rng':
      return s.model ? `RNG ${s.model}` : `RNG ${s.vendor}`;
    case 'dice': return `dados${count}`;
    case 'coin': return `moneda${count}`;
    case 'cards': return `cartas${count}`;
    case 'unknown': return 'origen desconocido';
  }
}

export function provenanceText(key: Key): string {
  const { sources, generatedBy } = key.provenance;
  const mix = sources.map(sourceText).join(' + ');
  if (!generatedBy) return `${mix}, calculada a mano`;
  const where = generatedBy.model ?? generatedBy.vendor;
  return `${mix} · generada en ${where}`;
}
