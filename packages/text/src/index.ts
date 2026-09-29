import type { EntropySource, Issue, Key, ModelIndex, Policy, SecretRef } from '@llave-inglesa/domain';
import type { AttackAtom, EntropyOrigin, Fact, Justification, LossEvent } from '@llave-inglesa/engine';

/**
 * Textos en español de todo lo que producen el dominio y el motor.
 * Funciones puras compartidas por la web y la CLI: el motor nunca produce texto.
 */

export type Label = (id: string) => string;

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------- Política y keys ----------

export function policyText(policy: Policy, label: Label): string {
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
  return `${mix} · generada en ${generatedBy.model ?? generatedBy.vendor}`;
}

// ---------- Ataques y pérdidas ----------

export const originText = (o: EntropyOrigin) => (o.kind === 'unknown' ? 'origen desconocido' : o.vendor);

export function attackText(a: AttackAtom, label: Label): string {
  switch (a.type) {
    case 'burglary': return `Intrusión en ${label(a.location)}`;
    case 'coercion': return a.location ? `Llave inglesa a ${label(a.person)} en ${label(a.location)}` : `Llave inglesa a ${label(a.person)}`;
    case 'insider': return `Traición de ${label(a.person)}`;
    case 'entropy-compromise': return `RNG comprometido: ${originText(a.origin)}`;
  }
}

export function lossText(e: LossEvent, label: Label): string {
  switch (e.type) {
    case 'destroy-location': return `Destrucción de ${label(e.location)}`;
    case 'item-loss': return `Pérdida de ${label(e.item)}`;
    case 'death': return `Fallecimiento de ${label(e.person)}`;
    case 'incapacity': return `Incapacidad de ${label(e.person)}`;
    case 'forget': return `${label(e.person)} olvida lo memorizado`;
  }
}

// ---------- Explicaciones del motor ----------

export function secretText(s: SecretRef, label: Label): string {
  switch (s.type) {
    case 'seed': return `semilla de ${label(s.key)}`;
    case 'passphrase': return `passphrase de ${label(s.key)}`;
    case 'xpub': return `xpub de ${label(s.key)}`;
    case 'pin': return `PIN de ${label(s.device)}`;
    case 'descriptor': return 'descriptor del wallet';
  }
}

export function factText(f: Fact, index: ModelIndex): string {
  switch (f.kind) {
    case 'item': {
      const item = index.items.get(f.item);
      return item ? `${item.value.label} (${index.label(item.value.location)})` : f.item;
    }
    case 'secret': return secretText(f.secret, index.label);
    case 'unlocked': return `${index.label(f.device)} desbloqueado`;
    case 'sign': return `firma con ${index.label(f.key)}`;
    case 'spend': return 'Puede gastar los fondos';
  }
}

/** Por qué se cumple un hecho. Cadena vacía cuando las premisas ya lo cuentan todo. */
export function ruleText(j: Justification, index: ModelIndex, policy: Policy): string {
  const v = j.via ?? {};
  const name = (id: string | undefined) => index.label(id ?? '?');
  switch (j.rule) {
    case 'location-access': return `al alcance en ${name(v.location)}`;
    case 'memory': return `lo sabe ${name(v.person)}`;
    case 'entropy-compromise': return `predecible: RNG de ${(v.origins ?? []).map(originText).join(' + ')}`;
    case 'read-artifact': return 'escrito ahí';
    case 'descriptor-xpubs': return 'incluida en el descriptor';
    case 'unlock-device': return '';
    case 'device-sign': return 'firma el dispositivo';
    case 'device-xpub': return 'la exporta el dispositivo';
    case 'device-wallet': return `multisig registrado en ${name(v.device)}`;
    case 'seed-xpub': return 'derivada de la semilla';
    case 'seed-sign': return 'tecleando la semilla en cualquier software';
    case 'seed-sign-on-device': return `cargando la semilla en ${name(v.device)}`;
    case 'spend': return `política ${policyText(policy, index.label)} satisfecha`;
  }
}

// ---------- Validación ----------

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

export function issueText(issue: Issue, label: Label): string {
  const base = ISSUE_TEXT[issue.code];
  if (issue.code === 'schema') {
    const field = issue.path.at(-1);
    if (field === 'name' || field === 'label') return 'Hay un nombre vacío';
    if (field === 'fingerprint') return 'El fingerprint debe tener 8 caracteres hexadecimales';
    return issue.detail ? `${base} (${issue.detail})` : base;
  }
  return issue.ref ? `${base}: ${label(issue.ref)}` : base;
}
