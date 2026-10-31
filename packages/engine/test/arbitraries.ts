import fc from 'fast-check';
import type { CustodyModel, CustodyModelInput, SecretRef } from '@llave-inglesa/domain';
import { parse } from './helpers.ts';

/** Generador de modelos válidos pequeños pero variados. */
export const modelArb: fc.Arbitrary<CustodyModel> = fc
  .record({
    nKeys: fc.integer({ min: 1, max: 3 }),
    nLocs: fc.integer({ min: 1, max: 3 }),
    nPeople: fc.integer({ min: 1, max: 3 }),
    nDevices: fc.integer({ min: 0, max: 2 }),
  })
  .chain(({ nKeys, nLocs, nPeople, nDevices }) => {
    const key = fc.integer({ min: 0, max: nKeys - 1 }).map((i) => `k${i}`);
    const loc = fc.integer({ min: 0, max: nLocs - 1 }).map((i) => `l${i}`);
    const person = fc.integer({ min: 0, max: nPeople - 1 }).map((i) => `p${i}`);
    const secret: fc.Arbitrary<SecretRef> = fc.oneof(
      key.map((k) => ({ type: 'seed' as const, key: k })),
      key.map((k) => ({ type: 'passphrase' as const, key: k })),
      key.map((k) => ({ type: 'xpub' as const, key: k })),
      fc.constant({ type: 'descriptor' as const }),
      ...(nDevices > 0 ? [fc.integer({ min: 0, max: nDevices - 1 }).map((i) => ({ type: 'pin' as const, device: `d${i}` }))] : []),
    );
    return fc.record({
      k: fc.integer({ min: 1, max: nKeys }),
      keys: fc.array(fc.record({ passphrase: fc.boolean(), vendor: fc.constantFrom('A', 'B'), dice: fc.boolean() }), { minLength: nKeys, maxLength: nKeys }),
      devices: fc.array(
        fc.record({ stateful: fc.boolean(), key, pin: fc.boolean(), registered: fc.boolean(), loc }),
        { minLength: nDevices, maxLength: nDevices },
      ),
      artifacts: fc.array(fc.record({ secret, loc }), { maxLength: 6 }),
      knows: fc.array(fc.record({ person, secret }), { maxLength: 4 }),
      access: fc.array(fc.record({ person, loc, afterDeath: fc.boolean() }), { maxLength: 6 }),
      nPeople: fc.constant(nPeople),
      nLocs: fc.constant(nLocs),
      // Protección de cada ubicación y si la segunda está dentro de la primera.
      protections: fc.array(fc.constantFrom(undefined, 'home-safe' as const, 'bank-box' as const), { minLength: nLocs, maxLength: nLocs }),
      nested: fc.boolean(),
      // Timelock como una opción más del umbral (solo con k ≥ 2: con k = 1 bastaría esperar) y cada cuánto se renueva.
      timelock: fc.option(fc.integer({ min: 1, max: 3 })),
      renewal: fc.option(fc.integer({ min: 1, max: 3 })),
    });
  })
  .map((r): CustodyModel => {
    const input: CustodyModelInput = {
      format: 'llave-inglesa',
      version: 1,
      name: 'aleatorio',
      keys: r.keys.map((k, i) => ({
        id: `k${i}`,
        label: `K${i}`,
        passphrase: k.passphrase,
        provenance: {
          sources: [{ kind: 'device-rng', vendor: k.vendor }, ...(k.dice ? [{ kind: 'dice' as const }] : [])],
          generatedBy: { vendor: k.vendor },
        },
      })),
      policy: {
        type: 'thresh',
        k: r.k,
        of: [
          ...r.keys.map((_, i) => ({ type: 'key' as const, key: `k${i}` })),
          ...(r.timelock !== null && r.k >= 2 ? [{ type: 'older' as const, blocks: r.timelock }] : []),
        ],
      },
      ...(r.renewal !== null && { renewal: { everyDays: r.renewal } }),
      devices: r.devices.map((d, i) => ({
        id: `d${i}`,
        label: `D${i}`,
        vendor: 'A',
        kind: d.stateful ? 'stateful' : 'stateless',
        holds: d.stateful ? [d.key] : [],
        pinProtected: d.pin,
        registeredWallet: d.registered,
        location: d.loc,
      })),
      artifacts: r.artifacts.map((a, i) => ({ id: `a${i}`, label: `A${i}`, medium: 'paper', contents: [a.secret], location: a.loc })),
      people: Array.from({ length: r.nPeople }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        role: i === 0 ? 'owner' : 'heir',
        knows: r.knows.filter((k) => k.person === `p${i}`).map((k) => k.secret),
      })),
      locations: Array.from({ length: r.nLocs }, (_, i) => ({
        id: `l${i}`,
        name: `L${i}`,
        ...(r.protections[i] && { protection: r.protections[i] }),
        ...(r.nested && i === 1 && { inside: 'l0' }),
        access: r.access
          .filter((a) => a.loc === `l${i}`)
          .map((a) => ({ person: a.person, when: a.afterDeath ? { type: 'after-death' as const, person: 'p0' } : { type: 'always' as const } })),
      })),
    };
    return parse(input);
  });

/**
 * Modelos con keys Shamir: cada key elegida pasa a k de n y cada semilla suya escrita o memorizada pasa a ser una
 * share cualquiera (o varias). Así se generan repartos de todo tipo: juntos, separados, incompletos.
 */
export const shamirModelArb: fc.Arbitrary<CustodyModel> = modelArb.chain((m) =>
  fc
    .record({
      split: fc.array(fc.boolean(), { minLength: m.keys.length, maxLength: m.keys.length }),
      k: fc.integer({ min: 1, max: 3 }),
      n: fc.integer({ min: 1, max: 4 }),
      picks: fc.array(fc.subarray([1, 2, 3, 4], { minLength: 1 }), { minLength: 12, maxLength: 12 }),
    })
    .map(({ split, k, n, picks }) => {
      const splitKeys = new Set(m.keys.filter((_, i) => split[i]).map((key) => key.id));
      const total = Math.max(n, 1);
      let p = 0;
      const shares = (s: SecretRef): SecretRef[] => {
        if (s.type !== 'seed' || !splitKeys.has(s.key)) return [s];
        const chosen = picks[p++ % picks.length]!.filter((x) => x <= total);
        return (chosen.length ? chosen : [1]).map((share) => ({ type: 'share' as const, key: s.key, share }));
      };
      const input = {
        ...m,
        keys: m.keys.map((key) => (splitKeys.has(key.id) ? { ...key, split: { scheme: 'shamir' as const, k: Math.min(k, total), shares: Array.from({ length: total }, (_, i) => i + 1) } } : key)),
        artifacts: m.artifacts.map((a) => ({ ...a, contents: a.contents.flatMap(shares) })),
        people: m.people.map((person) => ({ ...person, knows: person.knows.flatMap(shares) })),
      };
      return parse(input);
    }),
);
