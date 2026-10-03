import { ADVISORIES } from '@llave-inglesa/domain';
import type { AdvisoryKind, AdvisoryMatch, EntropySource, Mitigation, Issue, Key, ModelIndex, Person, Policy, SecretRef } from '@llave-inglesa/domain';
import type { AttackAtom, DuressReport, ScoreBand, EntropyOrigin, Fact, InheritanceReport, Justification, LossEvent } from '@llave-inglesa/engine';

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

const locationKind = (index: ModelIndex, id: string) => index.locations.get(id)?.kind ?? 'physical';

export const ROLE_TEXT: Record<Person['role'], string> = {
  owner: 'titular',
  heir: 'heredero/a',
  custodian: 'custodio/a',
  other: 'otra persona',
};

/** "A", "A y B", "A, B y C". */
export const listText = (items: readonly string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`);

/**
 * Quién recupera la herencia, distinguiendo herederos de quien les ayuda (custodios…).
 * Sin las ubicaciones: quien lo usa añade "yendo a …".
 */
export function inheritanceText(inh: InheritanceReport, people: readonly Person[]): string {
  const who = (ids: readonly string[]) =>
    listText(ids.map((id) => {
      const p = people.find((x) => x.id === id);
      return p ? `${p.name} (${ROLE_TEXT[p.role]})` : id;
    }));
  const verb = (ids: readonly string[], one: string, many: string) => (ids.length === 1 ? one : many);
  switch (inh.status) {
    case 'no-heirs':
      return 'Tras el fallecimiento de los titulares no queda nadie que pueda llegar a los fondos';
    case 'unrecoverable':
      return inh.heirs.length > 0
        ? `${who(inh.heirs)} no ${verb(inh.heirs, 'consigue', 'consiguen')} recuperar los fondos`
        : 'Nadie tiene papel de heredero, y quien queda no consigue recuperar los fondos';
    case 'ok':
      if (inh.heirs.length === 0) return `Nadie tiene papel de heredero, pero ${who(inh.helpers)} ${verb(inh.helpers, 'puede', 'pueden')} recuperar los fondos`;
      return (
        `${who(inh.heirs)} ${verb(inh.heirs, 'recupera', 'recuperan')} los fondos` +
        (inh.helpers.length > 0 ? ` con la ayuda de ${who(inh.helpers)}` : '')
      );
  }
}

/** Nombre corto de cada tipo de ataque (p. ej. para explicar su esfuerzo). */
export const ATTACK_KIND_TEXT: Record<AttackAtom['type'], string> = {
  burglary: 'robo sin nadie presente',
  insider: 'traición',
  coercion: 'llave inglesa',
  'entropy-compromise': 'RNG con fallo desconocido',
  'known-weak-entropy': 'fallo de entropía publicado',
  'malicious-firmware': 'firmware malicioso',
  'passphrase-bruteforce': 'fuerza bruta a la passphrase',
};

export const PASSPHRASE_STRENGTH_TEXT = { weak: 'débil', phrase: 'frase', random: 'aleatoria larga' } as const;

/** El mismo átomo se cuenta distinto según la ubicación: no se "entra" en una nube. */
export function attackText(a: AttackAtom, index: ModelIndex): string {
  const label = index.label;
  switch (a.type) {
    case 'burglary': {
      const kind = locationKind(index, a.location);
      const verb = kind === 'cloud' ? 'Hackeo de' : kind === 'device' ? 'Robo o malware en' : 'Intrusión en';
      return `${verb} ${label(a.location)}`;
    }
    case 'coercion': return a.location ? `Llave inglesa a ${label(a.person)} en ${label(a.location)}` : `Llave inglesa a ${label(a.person)}`;
    case 'insider': return `Traición de ${label(a.person)}`;
    case 'entropy-compromise': return `RNG con fallo aún desconocido: ${originText(a.origin)}`;
    case 'known-weak-entropy': return `Semilla adivinable por un fallo publicado: ${advisoryShortName(a.advisory)}`;
    case 'malicious-firmware': return `Firmware malicioso: ${a.vendor}`;
    case 'passphrase-bruteforce': return `Fuerza bruta a la passphrase de ${label(a.key)} (${PASSPHRASE_STRENGTH_TEXT[a.strength]})`;
  }
}

export function lossText(e: LossEvent, index: ModelIndex): string {
  const label = index.label;
  switch (e.type) {
    case 'destroy-location': {
      const kind = locationKind(index, e.location);
      if (e.disaster === 'fire') return `Incendio en ${label(e.location)}`;
      if (e.disaster === 'flood') return `Inundación en ${label(e.location)}`;
      const what = kind === 'cloud' ? 'Pérdida de la cuenta' : kind === 'device' ? 'Avería de' : 'Pérdida del acceso a';
      return `${what} ${label(e.location)}`;
    }
    case 'item-loss': return `Pérdida de ${label(e.item)}`;
    case 'death': return `Fallecimiento de ${label(e.person)}`;
    case 'incapacity': return `Incapacidad de ${label(e.person)}`;
    case 'forget': return `${label(e.person)} olvida lo memorizado`;
  }
}

/** Cómo se lee una puntuación (bandas de la calibración). */
export const SCORE_BAND_TEXT: Record<ScoreBand, string> = {
  'very-poor': 'Muy mal',
  weak: 'Flojo',
  fair: 'Aceptable',
  good: 'Bueno',
  excellent: 'Excelente',
};

const effortText = (e: number) => e.toLocaleString('es');

/**
 * Qué aporta el PIN de coacción de un dispositivo a la seguridad (`score` y `minEffort`, los
 * actuales). Si no aporta nada, por qué: la vía más barata no necesita desbloquear ese dispositivo.
 */
export function duressText(r: DuressReport, security: { score: number; minEffort: number | null }, index: ModelIndex): string {
  const device = index.label(r.device);
  if (r.helps) {
    if (r.minEffortWithout !== null && security.minEffort !== null && r.minEffortWithout !== security.minEffort) {
      return `El PIN de coacción de ${device} encarece el robo más barato: esfuerzo ${effortText(r.minEffortWithout)} → ${effortText(security.minEffort)} (seguridad ${r.scoreWithout} → ${security.score}).`;
    }
    return `El PIN de coacción de ${device} encarece algunas vías de robo: seguridad ${r.scoreWithout} → ${security.score}.`;
  }
  const prefix = `El PIN de coacción de ${device} no cambia la nota`;
  if (!r.bypass) return `${prefix}.`;
  const route = r.bypass.map((a) => attackText(a, index)).join(' + ');
  if (!r.bypass.some((a) => a.type === 'coercion')) {
    return `${prefix}: el robo más barato (${route}) no usa la llave inglesa, que es lo único que frena un PIN de coacción.`;
  }
  const items = r.bypassItems.filter((i) => i !== r.device).map(index.label);
  const why = items.length ? `se lleva ${listText(items)}` : 'consigue lo que necesita por otro camino';
  return `${prefix}: con ${lowerFirst(route)} no hace falta desbloquearlo, porque el atacante ${why}.`;
}

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

// ---------- Explicaciones del motor ----------

export function secretText(s: SecretRef, label: Label): string {
  switch (s.type) {
    case 'seed': return `semilla de ${label(s.key)}`;
    case 'passphrase': return `passphrase de ${label(s.key)}`;
    case 'xpub': return `xpub de ${label(s.key)}`;
    case 'pin': return `PIN de ${label(s.device)}`;
    case 'password': return `contraseña de ${label(s.artifact)}`;
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
    case 'entropy-compromise': return `predecible si el RNG de ${(v.origins ?? []).map(originText).join(' + ')} tiene un fallo aún desconocido`;
    case 'known-weak-entropy': return `adivinable por un fallo publicado (${advisoryShortName(v.advisory ?? '')})`;
    case 'malicious-firmware': return `filtrada en las firmas por un firmware malicioso de ${v.vendor}`;
    case 'passphrase-bruteforce': return `adivinada por fuerza bruta a partir de la semilla (passphrase ${PASSPHRASE_STRENGTH_TEXT[v.strength ?? 'weak']})`;
    case 'physical-extraction': return `extraída del hardware de ${name(v.device)} pese al PIN (${advisoryShortName(v.advisory ?? '')})`;
    case 'read-artifact': return 'escrito ahí';
    case 'descriptor-xpubs': return 'incluida en el descriptor';
    case 'unlock-device': return '';
    case 'device-sign': return 'firma el dispositivo';
    case 'device-xpub': return 'la exporta el dispositivo';
    case 'device-wallet': return `multisig registrado en ${name(v.device)}`;
    case 'seed-xpub': return 'derivada de la semilla';
    case 'seed-sign': return 'tecleando la frase semilla en cualquier software';
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
  'pin-unknown': 'Hay un dispositivo con PIN que nadie sabe ni está apuntado: no sirve para firmar',
  'duplicate-label': 'Hay varios elementos con el mismo nombre: no se distinguirán en las listas',
  'threshold-out-of-range': 'El umbral de la política es mayor que el número de keys',
  'key-repeated-in-policy': 'Una key aparece dos veces en la política',
  'key-not-in-policy': 'Hay una key que no participa en la política',
  'no-owner': 'Falta una persona con rol de titular',
  'passphrase-strength-unset': 'Hay una passphrase sin fortaleza indicada: se trata como débil',
  'protection-not-physical': 'Solo una ubicación física puede ser caja fuerte o caja del banco',
  'invalid-nesting': 'Una ubicación está dentro de otra de forma no válida (ambas físicas y un solo nivel)',
};

export function issueText(issue: Issue, label: Label): string {
  const base = ISSUE_TEXT[issue.code];
  if (issue.code === 'schema') {
    const field = issue.path.at(-1);
    if (field === 'name' || field === 'label') return 'Hay un nombre vacío';
    if (field === 'fingerprint') return 'El fingerprint debe tener 8 caracteres hexadecimales';
    return issue.detail ? `${base} (${issue.detail})` : base;
  }
  if (issue.code === 'duplicate-label' && issue.detail) return `Hay varios elementos que se llaman «${issue.detail}»: ponles nombres distintos para distinguirlos en las listas`;
  if (issue.code === 'pin-unknown' && issue.ref) return `Nadie sabe el PIN de ${label(issue.ref)} ni está apuntado: no sirve para firmar`;
  return issue.ref ? `${base}: ${label(issue.ref)}` : base;
}

// ---------- Catálogo de hardware ----------

export const ADVISORY_TITLE: Record<string, string> = {
  'coldcard-rng-2026': 'Coldcard: semillas con entropía débil (RNG)',
  'trezor-glitch-2020': 'Trezor One/T: extracción de la semilla con acceso físico',
  'trezor-safe3-donjon-2025': 'Trezor Safe 3: firmware del microcontrolador manipulable',
  'jade-register-descriptor-2025': 'Jade: explotable desde un ordenador con malware',
  'bitbox02-2026-08': 'BitBox02: explotable desde un ordenador con malware',
};

/** Nombre corto de un aviso: marca y año (p. ej. "Coldcard 2026"). */
export function advisoryShortName(id: string): string {
  const advisory = ADVISORIES.find((a) => a.id === id);
  const title = ADVISORY_TITLE[id];
  if (!advisory || !title) return id;
  return `${title.split(':')[0]} ${advisory.disclosed.slice(0, 4)}`;
}

export const ADVISORY_KIND: Record<AdvisoryKind, string> = {
  'weak-entropy': 'La semilla generada con este firmware es predecible: actualizar no la arregla, hay que migrar a una semilla nueva.',
  'physical-extraction': 'Con el dispositivo en la mano se puede sacar la semilla aunque tenga PIN.',
  'host-exploit': 'Un ordenador o móvil con malware conectado por USB o Bluetooth puede atacar el dispositivo.',
  'supply-chain': 'Podría llegar manipulado sin que su comprobación de autenticidad lo detecte.',
};

export function mitigationText(m: Mitigation): string {
  switch (m.type) {
    case 'own-entropy': return `mezclar al menos ${m.minBits} bits de entropía propia (unas ${Math.ceil(m.minBits / Math.log2(6))} tiradas de dado)`;
    case 'passphrase': return 'passphrase';
    case 'qr-only': return 'usarlo solo por QR';
  }
}

export function advisoryText(match: AdvisoryMatch): { title: string; detail: string; mitigations: string | null } {
  const a = match.advisory;
  const fixed = [...new Set(a.affects.map((r) => r.fixedIn).filter(Boolean))];
  const detail = [
    ADVISORY_KIND[a.kind],
    a.exploited ? 'Ya se ha explotado para robar fondos.' : null,
    fixed.length > 0 ? `Corregido en ${fixed.join(', ')}.` : 'No se puede corregir por firmware.',
    match.reason === 'unknown-firmware' ? 'Sin saber la versión de firmware, asumimos que está afectado.' : null,
    match.reason === 'unrecognized-firmware' ? 'No reconocemos esa versión de firmware para este modelo: revisa que esté completa y sea la correcta. Mientras, asumimos que está afectado.' : null,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    title: ADVISORY_TITLE[a.id] ?? a.id,
    detail,
    mitigations: a.mitigations.length > 0 ? `Mitiga: ${a.mitigations.map(mitigationText).join(' o ')}.` : null,
  };
}
