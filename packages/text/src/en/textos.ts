import { ADVISORIES, UNKNOWN_VENDOR, itemPlace } from '@llave-inglesa/domain';
import type { AdvisoryKind, AdvisoryMatch, EntropySource, Mitigation, Issue, Key, ModelIndex, Person, Policy, SecretRef } from '@llave-inglesa/domain';
import type * as es from '../es/textos.ts';
import type { Label } from '../tipos.ts';
import type { AttackAtom, DuressReport, ScoreBand, EntropyOrigin, Fact, InheritanceReport, Justification, LossEvent } from '@llave-inglesa/engine';

/**
 * English texts for everything the domain and the engine produce. Same shape as es/textos.ts.
 * Pure functions shared by the web and the CLI: the engine never produces text.
 */

// ---------- Policy and keys ----------

export const policyText: typeof es.policyText = (policy: Policy, label: Label): string => {
  if (policy.type === 'key') return label(policy.key);
  const allKeys = policy.of.every((p) => p.type === 'key');
  return allKeys ? `${policy.k} of ${policy.of.length}` : `${policy.k} of ${policy.of.length} (${policy.of.map((p) => policyText(p, label)).join(', ')})`;
};

/** A vendor as shown: the model's «Desconocido» (`UNKNOWN_VENDOR`) is a stored value, shown translated. */
export const vendorText: typeof es.vendorText = (vendor) => (vendor.trim().toLowerCase() === UNKNOWN_VENDOR.toLowerCase() ? 'Unknown' : vendor);

function sourceText(s: EntropySource): string {
  const count = 'count' in s && s.count ? ` ×${s.count}` : '';
  switch (s.kind) {
    case 'device-rng':
    case 'software-rng':
      return s.model ? `RNG ${s.model}` : `RNG ${vendorText(s.vendor)}`;
    case 'dice': return `dice${count}`;
    case 'coin': return `coin${count}`;
    case 'cards': return `cards${count}`;
    case 'unknown': return 'unknown source';
  }
}

export const provenanceText: typeof es.provenanceText = (key: Key) => {
  const { sources, generatedBy } = key.provenance;
  const mix = sources.map(sourceText).join(' + ');
  if (!generatedBy) return `${mix}, computed by hand`;
  return `${mix} · generated on ${generatedBy.model ?? vendorText(generatedBy.vendor)}`;
};

// ---------- Attacks and losses ----------

export const originText: typeof es.originText = (o: EntropyOrigin) => (o.kind === 'unknown' ? 'unknown source' : vendorText(o.vendor));

const locationKind = (index: ModelIndex, id: string) => index.locations.get(id)?.kind ?? 'physical';

export const ROLE_TEXT: Record<Person['role'], string> = {
  owner: 'owner',
  heir: 'heir',
  custodian: 'custodian',
  other: 'other person',
};

/** "A", "A and B", "A, B, and C". */
export const listText: typeof es.listText = (items) =>
  items.length <= 1 ? (items[0] ?? '') : items.length === 2 ? `${items[0]} and ${items[1]}` : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;

/**
 * Who recovers the inheritance, telling heirs apart from those who help them (custodians…).
 * Without the locations: the caller adds "going to …".
 */
export const inheritanceText: typeof es.inheritanceText = (inh: InheritanceReport, people: readonly Person[]) => {
  const who = (ids: readonly string[]) =>
    listText(ids.map((id) => {
      const p = people.find((x) => x.id === id);
      return p ? `${p.name} (${ROLE_TEXT[p.role]})` : id;
    }));
  const verb = (ids: readonly string[], one: string, many: string) => (ids.length === 1 ? one : many);
  switch (inh.status) {
    case 'no-heirs':
      return 'After the death of the owners, nobody is left who can reach the funds';
    case 'unrecoverable':
      return inh.heirs.length > 0
        ? `${who(inh.heirs)} cannot recover the funds`
        : 'Nobody has the heir role, and those who remain cannot recover the funds';
    case 'ok':
      if (inh.heirs.length === 0) return `Nobody has the heir role, but ${who(inh.helpers)} can recover the funds`;
      return (
        `${who(inh.heirs)} ${verb(inh.heirs, 'recovers', 'recover')} the funds` +
        (inh.helpers.length > 0 ? ` with the help of ${who(inh.helpers)}` : '')
      );
  }
};

/** Short name of each kind of attack (e.g. to explain its effort). */
export const ATTACK_KIND_TEXT: Record<AttackAtom['type'], string> = {
  burglary: 'burglary with nobody present',
  insider: 'betrayal',
  coercion: 'wrench attack',
  'entropy-compromise': 'RNG with an unknown flaw',
  'known-weak-entropy': 'published entropy flaw',
  'weak-own-entropy': 'seed with too little own entropy',
  'malicious-firmware': 'malicious firmware',
  'passphrase-bruteforce': 'passphrase brute force',
};

export const PASSPHRASE_STRENGTH_TEXT: Record<'weak' | 'phrase' | 'random', string> = { weak: 'weak', phrase: 'phrase', random: 'long random' };

/** The same atom reads differently depending on the location: you don't "break into" a cloud. */
export const attackText: typeof es.attackText = (a: AttackAtom, index: ModelIndex) => {
  const label = index.label;
  switch (a.type) {
    case 'burglary': {
      const kind = locationKind(index, a.location);
      const verb = kind === 'cloud' ? 'Hacking' : kind === 'device' ? 'Theft of or malware on' : 'Break-in at';
      return `${verb} ${label(a.location)}`;
    }
    case 'coercion': return a.location ? `Wrench attack on ${label(a.person)} at ${label(a.location)}` : `Wrench attack on ${label(a.person)}`;
    case 'insider': return `Betrayal by ${label(a.person)}`;
    case 'entropy-compromise': return `RNG with a still-unknown flaw: ${originText(a.origin)}`;
    case 'known-weak-entropy': return `Seed guessable through a published flaw: ${advisoryShortName(a.advisory)}`;
    case 'weak-own-entropy': return `Brute force on the seed of ${label(a.key)} (too little own entropy)`;
    case 'malicious-firmware': return `Malicious firmware: ${vendorText(a.vendor)}`;
    case 'passphrase-bruteforce': return `Brute force on the passphrase of ${label(a.key)} (${PASSPHRASE_STRENGTH_TEXT[a.strength]})`;
  }
};

export const lossText: typeof es.lossText = (e: LossEvent, index: ModelIndex) => {
  const label = index.label;
  switch (e.type) {
    case 'destroy-location': {
      const kind = locationKind(index, e.location);
      if (e.disaster === 'fire') return `Fire at ${label(e.location)}`;
      if (e.disaster === 'flood') return `Flood at ${label(e.location)}`;
      const what = kind === 'cloud' ? 'Loss of the account' : kind === 'device' ? 'Failure of' : 'Loss of access to';
      return `${what} ${label(e.location)}`;
    }
    case 'item-loss': return `Loss of ${label(e.item)}`;
    case 'death': return `Death of ${label(e.person)}`;
    case 'incapacity': return `Incapacity of ${label(e.person)}`;
    case 'forget': return `${label(e.person)} forgets what was memorized`;
  }
};

/** How a score reads (calibration bands). */
export const SCORE_BAND_TEXT: Record<ScoreBand, string> = {
  'very-poor': 'Very poor',
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  excellent: 'Excellent',
};

const effortText = (e: number) => e.toLocaleString('en-US');

/** Lowercases the first letter, unless it starts an acronym ("RNG…"). */
const lowerFirst = (t: string) => (/^[A-Z][A-Z]/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));

/**
 * What a device's duress PIN adds to security (`score` and `minEffort`, the current ones). If it adds nothing,
 * why: the cheapest route does not need to unlock that device.
 */
export const duressText: typeof es.duressText = (r: DuressReport, security, index: ModelIndex) => {
  const device = index.label(r.device);
  if (r.helps) {
    if (r.minEffortWithout !== null && security.minEffort !== null && r.minEffortWithout !== security.minEffort) {
      return `The duress PIN of ${device} makes the cheapest theft more expensive: effort ${effortText(r.minEffortWithout)} → ${effortText(security.minEffort)} (security ${r.scoreWithout} → ${security.score}).`;
    }
    return `The duress PIN of ${device} makes some theft routes more expensive: security ${r.scoreWithout} → ${security.score}.`;
  }
  const prefix = `The duress PIN of ${device} does not change the score`;
  if (!r.bypass) return `${prefix}.`;
  const route = r.bypass.map((a) => attackText(a, index)).join(' + ');
  if (!r.bypass.some((a) => a.type === 'coercion')) {
    return `${prefix}: the cheapest theft (${route}) does not use a wrench attack, which is the only thing a duress PIN stops.`;
  }
  const items = r.bypassItems.filter((i) => i !== r.device).map(index.label);
  const why = items.length ? `takes ${listText(items)}` : 'gets what they need some other way';
  return `${prefix}: with ${lowerFirst(route)} there is no need to unlock it, because the attacker ${why}.`;
};

// ---------- Engine explanations ----------

export const secretText: typeof es.secretText = (s: SecretRef, label: Label) => {
  switch (s.type) {
    case 'seed': return `seed of ${label(s.key)}`;
    case 'passphrase': return `passphrase of ${label(s.key)}`;
    case 'xpub': return `xpub of ${label(s.key)}`;
    case 'pin': return `PIN of ${label(s.device)}`;
    case 'password': return `password of ${label(s.artifact)}`;
    case 'descriptor': return 'wallet descriptor';
  }
};

export const factText: typeof es.factText = (f: Fact, index: ModelIndex) => {
  switch (f.kind) {
    case 'item': {
      const item = index.items.get(f.item);
      if (!item) return f.item;
      if (item.kind === 'computer' && item.value.carriedBy) return `${item.value.label} (carried by ${index.label(item.value.carriedBy)})`;
      return `${item.value.label} (${index.label(itemPlace(item))})`;
    }
    case 'secret': return secretText(f.secret, index.label);
    case 'unlocked': return `${index.label(f.device)} unlocked`;
    case 'sign': return `signature with ${index.label(f.key)}`;
    case 'spend': return 'Can spend the funds';
  }
};

/** Why a fact holds. Empty string when the premises already tell it all. */
export const ruleText: typeof es.ruleText = (j: Justification, index: ModelIndex, policy: Policy) => {
  const v = j.via ?? {};
  const name = (id: string | undefined) => index.label(id ?? '?');
  switch (j.rule) {
    case 'location-access': return `within reach at ${name(v.location)}`;
    case 'carried': return `${name(v.person)} carries it`;
    case 'computer-wallet': return `in the wallet on ${name(v.item)}`;
    case 'memory': return `${name(v.person)} knows it`;
    case 'entropy-compromise': return `predictable if the RNG of ${(v.origins ?? []).map(originText).join(' + ')} has a still-unknown flaw`;
    case 'known-weak-entropy': return `guessable through a published flaw (${advisoryShortName(v.advisory ?? '')})`;
    case 'weak-own-entropy':
      return v.bits
        ? `guessable by brute force: only ${Math.floor(v.bits)} bits of own entropy, below the standard 128`
        : 'guessable by brute force: the number of rolls is not set, so it does not count as entropy';
    case 'malicious-firmware': return `leaked in the signatures by malicious firmware from ${vendorText(v.vendor ?? '')}`;
    case 'passphrase-bruteforce': return `guessed by brute force from the seed (${PASSPHRASE_STRENGTH_TEXT[v.strength ?? 'weak']} passphrase)`;
    case 'physical-extraction': return `extracted from the hardware of ${name(v.device)} despite the PIN (${advisoryShortName(v.advisory ?? '')})`;
    case 'read-artifact': return 'written there';
    case 'descriptor-xpubs': return 'included in the descriptor';
    case 'unlock-device': return '';
    case 'device-sign': return 'the device signs';
    case 'device-xpub': return 'exported by the device';
    case 'device-wallet': return `multisig registered on ${name(v.device)}`;
    case 'seed-xpub': return 'derived from the seed';
    case 'seed-sign': return 'typing the seed phrase into any software';
    case 'seed-sign-on-device': return `loading the seed onto ${name(v.device)}`;
    case 'spend': return `policy ${policyText(policy, index.label)} satisfied`;
  }
};

// ---------- Validation ----------

const ISSUE_TEXT: Record<Issue['code'], string> = {
  'schema': 'A field has an invalid value',
  'duplicate-id': 'Two items have the same identifier',
  'unknown-reference': 'Something refers to an item that does not exist',
  'stateful-holds-nothing': 'A device does not hold any key',
  'pin-unknown': 'A device has a PIN that nobody knows and is not written down: it cannot be used to sign',
  'duplicate-label': 'Several items have the same name: they cannot be told apart in the lists',
  'threshold-out-of-range': 'The policy threshold is greater than the number of keys',
  'key-repeated-in-policy': 'A key appears twice in the policy',
  'key-not-in-policy': 'A key does not take part in the policy',
  'no-owner': 'There must be a person with the owner role',
  'passphrase-strength-unset': 'A passphrase has no strength set: it is treated as weak',
  'entropy-count-unset': 'Dice, coin or cards with no number of rolls set: they do not count as entropy',
  'multisig-without-descriptor': 'Multisig with no backup of the descriptor: without it, recovering the wallet needs every seed and knowing exactly how it was created, and may be impossible (the wallet on a computer or a device with the multisig registered is not enough: they break or get wiped). It is advisable to keep at least one copy of the descriptor; better still, one next to each key',
  'protection-not-physical': 'Only a physical location can be a home safe or a bank box',
  'invalid-nesting': 'A location is inside another in an invalid way (both must be physical, one level only)',
  'invalid-home': 'Someone lives somewhere you cannot live (it must be a physical location, not inside another one nor a bank box)',
  'invalid-computer-place': 'A signing computer must be kept in a location or carried by a person (one of the two)',
};

export const issueText: typeof es.issueText = (issue: Issue, label: Label) => {
  const base = ISSUE_TEXT[issue.code];
  if (issue.code === 'schema') {
    const field = issue.path.at(-1);
    if (field === 'name' || field === 'label') return 'A name is empty';
    if (field === 'fingerprint') return 'The fingerprint must be 8 hexadecimal characters';
    return issue.detail ? `${base} (${issue.detail})` : base;
  }
  if (issue.code === 'duplicate-label' && issue.detail) return `Several items are called “${issue.detail}”: give them different names to tell them apart in the lists`;
  if (issue.code === 'pin-unknown' && issue.ref) return `Nobody knows the PIN of ${label(issue.ref)} and it is not written down: it cannot be used to sign`;
  return issue.ref ? `${base}: ${label(issue.ref)}` : base;
};

// ---------- Hardware catalog ----------

export const ADVISORY_TITLE: Record<string, string> = {
  'coldcard-rng-2026': 'Coldcard: seeds with weak entropy (RNG)',
  'trezor-glitch-2020': 'Trezor One/T: seed extraction with physical access',
  'trezor-safe3-donjon-2025': 'Trezor Safe 3: microcontroller firmware can be tampered with',
  'jade-register-descriptor-2025': 'Jade: exploitable from a computer with malware',
  'bitbox02-2026-08': 'BitBox02: exploitable from a computer with malware',
};

/** Short name of an advisory: brand and year (e.g. "Coldcard 2026"). */
export const advisoryShortName: typeof es.advisoryShortName = (id: string) => {
  const advisory = ADVISORIES.find((a) => a.id === id);
  const title = ADVISORY_TITLE[id];
  if (!advisory || !title) return id;
  return `${title.split(':')[0]} ${advisory.disclosed.slice(0, 4)}`;
};

export const ADVISORY_KIND: Record<AdvisoryKind, string> = {
  'weak-entropy': 'Seeds generated with this firmware are predictable: updating does not fix them, you have to migrate to a new seed.',
  'physical-extraction': 'With the device in hand, the seed can be extracted even with a PIN.',
  'host-exploit': 'A computer or phone with malware connected over USB or Bluetooth can attack the device.',
  'supply-chain': 'It could arrive tampered with, without its authenticity check detecting it.',
};

export const mitigationText: typeof es.mitigationText = (m: Mitigation) => {
  switch (m.type) {
    case 'own-entropy': return `mixing in at least ${m.minBits} bits of your own entropy (about ${Math.ceil(m.minBits / Math.log2(6))} dice rolls)`;
    case 'passphrase': return 'a passphrase';
    case 'qr-only': return 'using it only via QR';
  }
};

export const advisoryText: typeof es.advisoryText = (match: AdvisoryMatch) => {
  const a = match.advisory;
  const fixed = [...new Set(a.affects.map((r) => r.fixedIn).filter(Boolean))];
  const detail = [
    ADVISORY_KIND[a.kind],
    a.exploited ? 'It has already been exploited to steal funds.' : null,
    fixed.length > 0 ? `Fixed in ${fixed.join(', ')}.` : 'It cannot be fixed with a firmware update.',
    match.reason === 'unknown-firmware' ? 'Without knowing the firmware version, we assume it is affected.' : null,
    match.reason === 'unrecognized-firmware' ? 'We do not recognize that firmware version for this model: check that it is complete and correct. Meanwhile, we assume it is affected.' : null,
  ]
    .filter(Boolean)
    .join(' ');
  return {
    title: ADVISORY_TITLE[a.id] ?? a.id,
    detail,
    mitigations: a.mitigations.length > 0 ? `Mitigated by ${a.mitigations.map(mitigationText).join(' or ')}.` : null,
  };
};
