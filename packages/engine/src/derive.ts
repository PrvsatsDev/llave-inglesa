import type { Id, SecretRef } from '@llave-inglesa/domain';
import type { EntropyOrigin } from './entropy.ts';
import { factId, type DerivedFact, type Fact, type FactId, type Justification } from './facts.ts';
import { satisfy } from './policy.ts';
import { itemsAvailableAt, knowledgeOf, type World } from './world.ts';

/**
 * - `any`: vale cualquier herramienta, p. ej. teclear la semilla en un software (ladrón, recuperación de emergencia).
 * - `secure`: solo firma en dispositivos de firma (uso legítimo del día a día).
 */
export type SigningMode = 'any' | 'secure';

/** Lo que tiene a su alcance un actor (o coalición de actores). */
export interface Holdings {
  /** Personas cuya memoria aporta secretos. */
  people: readonly Id[];
  /** Ubicaciones cuyo contenido tiene físicamente. */
  locations: readonly Id[];
  /** Semillas obtenidas sin acceso físico (RNG comprometido). */
  compromisedSeeds?: readonly { key: Id; origins: EntropyOrigin[] }[];
}

export interface Derivation {
  readonly facts: ReadonlyMap<FactId, DerivedFact>;
  readonly signable: ReadonlySet<Id>;
  readonly canSpend: boolean;
  has(fact: Fact): boolean;
}

const secret = (s: SecretRef): Fact => ({ kind: 'secret', secret: s });

/**
 * Motor de inferencia: parte de lo que el actor tiene y aplica reglas hasta el punto fijo.
 * Cada hecho guarda la primera justificación encontrada, que sirve de explicación.
 * Monótono: más `holdings` nunca produce menos hechos.
 */
export function derive(world: World, holdings: Holdings, mode: SigningMode): Derivation {
  const { model, index } = world;
  const facts = new Map<FactId, DerivedFact>();
  const has = (f: Fact) => facts.has(factId(f));
  let changed = false;
  const add = (fact: Fact, justification: Justification) => {
    const id = factId(fact);
    if (facts.has(id)) return;
    facts.set(id, { fact, justification });
    changed = true;
  };

  for (const location of holdings.locations) {
    for (const item of itemsAvailableAt(world, location)) {
      add({ kind: 'item', item: item.value.id }, { rule: 'location-access', premises: [], via: { location } });
    }
  }
  for (const person of holdings.people) {
    for (const s of knowledgeOf(world, person)) add(secret(s), { rule: 'memory', premises: [], via: { person } });
  }
  for (const { key, origins } of holdings.compromisedSeeds ?? []) {
    add(secret({ type: 'seed', key }), { rule: 'entropy-compromise', premises: [], via: { origins } });
  }

  const descriptorId = factId(secret({ type: 'descriptor' }));
  const xpub = (key: Id) => secret({ type: 'xpub', key });
  /** Premisas de passphrase para usar `key`, o null si hace falta y no se tiene. */
  const passphrasePremises = (key: Id): FactId[] | null => {
    if (!index.keys.get(key)?.passphrase) return [];
    const id = factId(secret({ type: 'passphrase', key }));
    return facts.has(id) ? [id] : null;
  };

  do {
    changed = false;

    for (const a of model.artifacts) {
      const itemId = factId({ kind: 'item', item: a.id });
      if (!facts.has(itemId)) continue;
      const locks = a.lockedBy.map((s) => factId(secret(s)));
      if (!locks.every((l) => facts.has(l))) continue;
      for (const s of a.contents) add(secret(s), { rule: 'read-artifact', premises: [itemId, ...locks], via: { item: a.id } });
    }

    if (facts.has(descriptorId)) {
      for (const key of index.policyKeys) add(xpub(key), { rule: 'descriptor-xpubs', premises: [descriptorId] });
    }

    for (const d of model.devices) {
      const itemId = factId({ kind: 'item', item: d.id });
      if (!facts.has(itemId)) continue;
      const pinId = factId(secret({ type: 'pin', device: d.id }));
      if (d.pinProtected && !facts.has(pinId)) continue;
      add({ kind: 'unlocked', device: d.id }, { rule: 'unlock-device', premises: d.pinProtected ? [itemId, pinId] : [itemId] });
    }

    for (const d of model.devices) {
      const unlockedId = factId({ kind: 'unlocked', device: d.id });
      if (d.kind !== 'stateful' || !facts.has(unlockedId)) continue;
      if (d.registeredWallet) {
        for (const key of index.policyKeys) add(xpub(key), { rule: 'device-wallet', premises: [unlockedId], via: { device: d.id } });
      }
      for (const key of d.holds) {
        const pass = passphrasePremises(key);
        if (!pass) continue;
        const premises = [unlockedId, ...pass];
        add({ kind: 'sign', key }, { rule: 'device-sign', premises, via: { device: d.id } });
        add(xpub(key), { rule: 'device-xpub', premises, via: { device: d.id } });
      }
    }

    const seedSigners = model.devices.filter(
      (d) => (d.kind === 'stateless' || d.acceptsExternalSeed) && has({ kind: 'unlocked', device: d.id }),
    );
    for (const key of index.keys.keys()) {
      const seedId = factId(secret({ type: 'seed', key }));
      if (!facts.has(seedId)) continue;
      const pass = passphrasePremises(key);
      if (!pass) continue;
      const premises = [seedId, ...pass];
      add(xpub(key), { rule: 'seed-xpub', premises });
      if (mode === 'any') {
        add({ kind: 'sign', key }, { rule: 'seed-sign', premises });
      } else if (seedSigners[0]) {
        const device = seedSigners[0].id;
        add({ kind: 'sign', key }, {
          rule: 'seed-sign-on-device',
          premises: [...premises, factId({ kind: 'unlocked', device })],
          via: { device },
        });
      }
    }
  } while (changed);

  const signable = new Set(index.policyKeys.filter((key) => has({ kind: 'sign', key })));
  const used = satisfy(model.policy, signable);
  // Para construir la transacción hacen falta las xpubs de TODAS las keys de la política.
  if (used && index.policyKeys.every((key) => has(xpub(key)))) {
    const missingXpubs = index.policyKeys.filter((key) => !used.includes(key));
    add({ kind: 'spend' }, {
      rule: 'spend',
      premises: [...used.map((key) => factId({ kind: 'sign', key })), ...missingXpubs.map((key) => factId(xpub(key)))],
    });
  }

  return { facts, signable, canSpend: has({ kind: 'spend' }), has };
}
