import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CustodyModel, CustodyModelInput, SecretRef } from '@llave-inglesa/domain';
import { attackAtoms, attackHoldings, createWorld, derive, legitHoldings, minimalCuts } from '../src/index.ts';
import { parse } from './helpers.ts';

/** Generador de modelos válidos pequeños pero variados. */
const modelArb: fc.Arbitrary<CustodyModel> = fc
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
      policy: { type: 'thresh', k: r.k, of: r.keys.map((_, i) => ({ type: 'key' as const, key: `k${i}` })) },
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

const subset = <T>(xs: readonly T[]) => fc.subarray([...xs]);

describe('propiedades del motor', () => {
  it('monotonía: tener más nunca permite hacer menos', () => {
    fc.assert(
      fc.property(
        modelArb.chain((m) => fc.tuple(
          fc.constant(m),
          subset(m.people.map((p) => p.id)), subset(m.locations.map((l) => l.id)),
          subset(m.people.map((p) => p.id)), subset(m.locations.map((l) => l.id)),
          fc.constantFrom('any' as const, 'secure' as const),
        )),
        ([model, p1, l1, p2, l2, mode]) => {
          const world = createWorld(model);
          const small = derive(world, { people: p1, locations: l1 }, mode);
          const big = derive(world, { people: [...p1, ...p2], locations: [...l1, ...l2] }, mode);
          for (const id of small.facts.keys()) expect(big.facts.has(id)).toBe(true);
        },
      ),
    );
  });

  it('si se puede firmar de forma segura, también de cualquier forma', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const world = createWorld(model);
        const h = legitHoldings(world);
        if (derive(world, h, 'secure').canSpend) expect(derive(world, h, 'any').canSpend).toBe(true);
      }),
    );
  });

  it('añadir un backup nunca empeora la recuperabilidad', () => {
    fc.assert(
      fc.property(
        modelArb.chain((m) => fc.tuple(fc.constant(m), fc.constantFrom(...m.locations.map((l) => l.id)), fc.constantFrom(...m.keys.map((k) => k.id)))),
        ([model, location, key]) => {
          const recoverable = (m: CustodyModel) => {
            const w = createWorld(m);
            return derive(w, legitHoldings(w), 'any').canSpend;
          };
          const extra = { id: 'extra', label: 'Extra', medium: 'metal' as const, contents: [{ type: 'seed' as const, key }], lockedBy: [], location };
          if (recoverable(model)) expect(recoverable({ ...model, artifacts: [...model.artifacts, extra] })).toBe(true);
        },
      ),
    );
  });

  it('cortes de robo: todos funcionan y ningún subconjunto estricto funciona', () => {
    fc.assert(
      fc.property(modelArb, (model) => {
        const world = createWorld(model);
        const steals = (atoms: ReturnType<typeof attackAtoms>) => derive(world, attackHoldings(world, atoms), 'any').canSpend;
        for (const cut of minimalCuts(attackAtoms(world), steals, 2)) {
          expect(steals(cut)).toBe(true);
          cut.forEach((_, i) => expect(steals(cut.filter((__, j) => j !== i))).toBe(false));
        }
      }),
      { numRuns: 50 },
    );
  });
});
