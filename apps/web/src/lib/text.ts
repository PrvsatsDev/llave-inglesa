import type { EntropySource, Issue, Key, Policy } from '@llave-inglesa/domain';

const ISSUE_TEXT: Record<Issue['code'], string> = {
  'schema': 'Hay un campo con un valor no válido',
  'duplicate-id': 'Hay dos elementos con el mismo identificador',
  'unknown-reference': 'Algo hace referencia a un elemento que no existe',
  'stateful-holds-nothing': 'Hay un dispositivo que no guarda ninguna key',
  'threshold-out-of-range': 'El umbral de la política es mayor que el número de keys',
  'key-repeated-in-policy': 'Una key aparece dos veces en la política',
  'key-not-in-policy': 'Hay una key que no participa en la política',
  'no-owner': 'Falta una persona con rol de titular',
};

export function issueText(issue: Issue, label: (id: string) => string): string {
  const base = ISSUE_TEXT[issue.code];
  if (issue.code === 'schema') {
    const field = issue.path.at(-1);
    if (field === 'name' || field === 'label') return 'Hay un nombre vacío';
    if (field === 'fingerprint') return 'El fingerprint debe tener 8 caracteres hexadecimales';
    return base;
  }
  return issue.ref ? `${base}: ${label(issue.ref)}` : base;
}

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
