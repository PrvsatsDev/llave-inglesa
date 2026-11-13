import { addComputer, addDevice, addLocation, blankModel, setDeviceShares, setKeyCoordinators, splitKey, updateDevice, walletDescriptor, walletOf, type CustodyModel, type CustodyModelInput, type SecretRef } from '@llave-inglesa/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { analyze, attackAtoms, createWorld, derive, simulateAttack, simulateSigning, type CompromisedSeed, type SigningMode } from '../src/index.ts';
import { parse } from './helpers.ts';

/**
 * Un esquema t de n descrito dos veces: como multisig de n keys y como una key FROST de n shares, con la key i (o la
 * share i) en los mismos sitios. Para que las xpubs no marquen la diferencia (eso es propio de cada uno), el multisig
 * tiene el descriptor junto a cada semilla y la cartera registrada en cada dispositivo.
 */
interface Shape {
  n: number;
  t: number;
  nLocs: number;
  nPeople: number;
  devices: { key: number; pin: boolean; loc: number }[];
  artifacts: { key: number; loc: number }[];
  knows: { person: number; key: number }[];
  access: { person: number; loc: number; afterDeath: boolean }[];
}

const shapeArb = (maxDevices: number): fc.Arbitrary<Shape> =>
  fc
    .record({ n: fc.integer({ min: 1, max: 3 }), nLocs: fc.integer({ min: 1, max: 3 }), nPeople: fc.integer({ min: 1, max: 2 }) })
    .chain(({ n, nLocs, nPeople }) =>
      fc.record({
        n: fc.constant(n),
        t: fc.integer({ min: 1, max: n }),
        nLocs: fc.constant(nLocs),
        nPeople: fc.constant(nPeople),
        devices: fc.array(fc.record({ key: fc.nat(n - 1), pin: fc.boolean(), loc: fc.nat(nLocs - 1) }), { maxLength: maxDevices }),
        artifacts: fc.array(fc.record({ key: fc.nat(n - 1), loc: fc.nat(nLocs - 1) }), { maxLength: 5 }),
        knows: fc.array(fc.record({ person: fc.nat(nPeople - 1), key: fc.nat(n - 1) }), { maxLength: 3 }),
        access: fc.array(fc.record({ person: fc.nat(nPeople - 1), loc: fc.nat(nLocs - 1), afterDeath: fc.boolean() }), { maxLength: 5 }),
      }),
    );

function build(s: Shape, frost: boolean): CustodyModel {
  const keyId = (i: number) => (frost ? 'f' : `k${i}`);
  const secretOf = (i: number): SecretRef[] => (frost ? [{ type: 'share', key: 'f', share: i + 1 }] : [{ type: 'seed', key: keyId(i) }, { type: 'descriptor' }]);
  const input: CustodyModelInput = {
    format: 'llave-inglesa',
    version: 1,
    name: 'equivalencia',
    keys: frost
      ? [{ id: 'f', label: 'F', split: { scheme: 'frost', k: s.t, shares: Array.from({ length: s.n }, (_, i) => i + 1) } }]
      : Array.from({ length: s.n }, (_, i) => ({ id: keyId(i), label: `K${i}` })),
    policy: frost || s.n === 1 ? { type: 'key', key: keyId(0) } : { type: 'thresh', k: s.t, of: Array.from({ length: s.n }, (_, i) => ({ type: 'key' as const, key: keyId(i) })) },
    devices: s.devices.map((d, i) => ({
      id: `d${i}`,
      label: `D${i}`,
      vendor: 'A',
      kind: 'stateful',
      holds: frost ? [] : [keyId(d.key)],
      ...(frost && { shares: [{ key: 'f', share: d.key + 1 }] }),
      pinProtected: d.pin,
      registeredWallet: !frost,
      location: `l${d.loc}`,
    })),
    artifacts: [
      ...s.artifacts.map((a, i) => ({ id: `a${i}`, label: `A${i}`, medium: 'paper' as const, contents: secretOf(a.key), location: `l${a.loc}` })),
      // Los PIN, apuntados en la primera ubicación.
      ...(s.devices.some((d) => d.pin) ? [{ id: 'pins', label: 'PINs', medium: 'paper' as const, contents: s.devices.flatMap((d, i) => (d.pin ? [{ type: 'pin' as const, device: `d${i}` }] : [])), location: 'l0' }] : []),
    ],
    people: Array.from({ length: s.nPeople }, (_, p) => ({
      id: `p${p}`,
      name: `P${p}`,
      role: p === 0 ? ('owner' as const) : ('heir' as const),
      knows: s.knows.filter((k) => k.person === p).flatMap((k) => secretOf(k.key)),
    })),
    locations: Array.from({ length: s.nLocs }, (_, l) => ({
      id: `l${l}`,
      name: `L${l}`,
      access: s.access.filter((a) => a.loc === l).map((a) => ({ person: `p${a.person}`, when: a.afterDeath ? { type: 'after-death' as const, person: 'p0' } : { type: 'always' as const } })),
    })),
  };
  return parse(input);
}

describe('FROST: equivalencia con el multisig', () => {
  it('con lo mismo a mano, se firma lo mismo (cualquier ubicación, persona, share comprometida y modo)', () => {
    fc.assert(
      fc.property(
        shapeArb(4).chain((s) =>
          fc.tuple(
            fc.constant(s),
            fc.subarray(Array.from({ length: s.nPeople }, (_, i) => `p${i}`)),
            fc.subarray(Array.from({ length: s.nLocs }, (_, i) => `l${i}`)),
            fc.subarray(Array.from({ length: s.n }, (_, i) => i)),
            fc.constantFrom<SigningMode>('any', 'secure'),
          ),
        ),
        ([s, people, locations, leaked, mode]) => {
          const multi = createWorld(build(s, false));
          const frost = createWorld(build(s, true));
          // Filtradas por un firmware: en el multisig, la semilla de la key; en FROST, la share. Más el descriptor,
          // que en FROST no hace falta: así las xpubs no cuentan.
          const seeds: CompromisedSeed[] = leaked.map((i) => ({ key: `k${i}`, firmware: 'A' }));
          const shares: CompromisedSeed[] = leaked.map((i) => ({ key: 'f', share: i + 1, firmware: 'A' }));
          const withDescriptor = (m: CustodyModel) => createWorld({ ...m, people: [...m.people, { id: 'obs', name: 'Obs', role: 'other', knows: [{ type: 'descriptor' }] }] });
          const a = derive(withDescriptor(multi.model), { people: [...people, 'obs'], locations, compromisedSeeds: seeds }, mode);
          const b = derive(frost, { people, locations, compromisedSeeds: shares }, mode);
          expect(b.canSpend).toBe(a.canSpend);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('sin dispositivos (solo backups y memorias), los mismos robos y las mismas pérdidas', () => {
    fc.assert(
      fc.property(shapeArb(0), (s) => {
        const [a, b] = [analyze(build(s, false)), analyze(build(s, true))];
        expect(b.security.cuts).toEqual(a.security.cuts);
        expect(b.security.efforts).toEqual(a.security.efforts);
        expect(b.resilience.cuts).toEqual(a.resilience.cuts);
        expect(b.resilience.lockouts).toEqual(a.resilience.lockouts);
        expect(b.inheritance.status).toEqual(a.inheritance.status);
      }),
      { numRuns: 80 },
    );
  });

  it('con dispositivos, el firmware malicioso de su fabricante alcanza a las shares que guardan', () => {
    const s: Shape = { n: 3, t: 2, nLocs: 2, nPeople: 1, devices: [{ key: 0, pin: false, loc: 0 }, { key: 1, pin: false, loc: 1 }], artifacts: [], knows: [], access: [] };
    const frost = build(s, true);
    expect(attackAtoms(createWorld(frost))).toContainEqual({ type: 'malicious-firmware', vendor: 'A' });
    const d = simulateAttack(frost, [{ type: 'malicious-firmware', vendor: 'A' }]);
    expect(d.facts.get('secret:share:f/1')?.justification.rule).toBe('malicious-firmware');
    expect(d.canSpend).toBe(true);
  });
});

/** Frostsnap 2 de 3: dispositivos en casa, en la oficina y en casa de los padres; el móvil, encima del titular. */
function frostsnap(): { model: CustodyModel; phone: string; devices: string[] } {
  let m = splitKey(blankModel(), 'k1', 'frost', 2, 3);
  const oficina = addLocation(m, 'Oficina');
  const padres = addLocation(oficina.model, 'Padres');
  m = padres.model;
  const devices: string[] = [];
  for (const [i, location] of (['casa', oficina.id, padres.id] as const).entries()) {
    const d = addDevice(m, location);
    devices.push(d.id);
    m = setDeviceShares(updateDevice(d.model, d.id, { vendor: 'Frostsnap', pinProtected: false }), d.id, [{ key: 'k1', share: i + 1 }]);
  }
  const phone = addComputer(m, { carriedBy: 'yo' });
  m = setKeyCoordinators(phone.model, 'k1', [phone.id]);
  return { model: m, phone: phone.id, devices };
}

describe('FROST: el coordinador (Frostsnap)', () => {
  const { model, phone, devices } = frostsnap();

  it('la cartera es Taproot, aunque el documento tuviera guardado otro tipo de dirección, y no admite más keys', () => {
    expect(walletOf(model)).toEqual({ script: 'tr', sorted: true });
    const old = { ...model, wallet: { script: 'wpkh' as const, sorted: true } };
    expect(walletOf(old)).toEqual({ script: 'tr', sorted: true });
    expect(walletDescriptor(old)).toEqual(walletDescriptor(model));
    const two: CustodyModel = { ...model, keys: [...model.keys, { ...model.keys[0]!, id: 'k2', label: 'K2', split: undefined }], policy: { type: 'thresh', k: 1, of: [{ type: 'key', key: 'k1' }, { type: 'key', key: 'k2' }] } };
    expect(walletDescriptor(two)).toEqual({ ok: false, problems: [{ code: 'frost-needs-taproot', keys: ['k1'] }] });
  });

  it('un dispositivo robado sin su móvil no sirve; con el móvil, firma su parte, pero falta otra', () => {
    const solo = simulateAttack(model, [{ type: 'burglary', location: 'casa' }]);
    expect(solo.facts.has('item:' + devices[0])).toBe(true);
    expect(solo.facts.has('share-sign:k1/1')).toBe(false);
    expect(solo.facts.has('secret:xpub:k1')).toBe(false);
    const conMovil = simulateAttack(model, [{ type: 'coercion', person: 'yo', location: 'casa' }]);
    expect(conMovil.facts.get('coordinator:k1')?.justification).toEqual({ rule: 'paired-coordinator', premises: ['item:' + phone], via: { item: phone } });
    expect(conMovil.facts.has('share-sign:k1/1')).toBe(true);
    expect(conMovil.canSpend).toBe(false);
  });

  it('con dos dispositivos se empareja un móvil nuevo y se firma, sin el del titular', () => {
    const banco = model.locations.find((l) => l.name === 'Oficina')!.id;
    const d = simulateAttack(model, [{ type: 'burglary', location: 'casa' }, { type: 'burglary', location: banco }]);
    expect(d.facts.get('coordinator:k1')?.justification.rule).toBe('pair-coordinator');
    expect(d.facts.get('sign:k1')?.justification.rule).toBe('frost-sign');
    expect(d.canSpend).toBe(true);
  });

  it('el malware del móvil emparejado da el coordinador', () => {
    expect(attackAtoms(createWorld(model))).toContainEqual({ type: 'computer-malware', computer: phone });
    const d = simulateAttack(model, [{ type: 'computer-malware', computer: phone }, { type: 'burglary', location: 'casa' }]);
    expect(d.facts.get('coordinator:k1')?.justification.rule).toBe('coordinator-malware');
    expect(d.facts.has('share-sign:k1/1')).toBe(true);
  });

  it('el titular firma a diario con el móvil y dos dispositivos, sin cargar nada en ningún sitio', () => {
    const d = simulateSigning(model);
    expect(d.canSpend).toBe(true);
    expect(d.facts.get('sign:k1')?.justification.rule).toBe('frost-sign');
    expect([...d.facts.values()].some((f) => f.justification.rule === 'seed-sign-on-device')).toBe(false);
  });

  it('una tarjeta de backup es la share en claro: con un dispositivo, basta para robar, con el móvil o sin él', () => {
    const card = { id: 'tarjeta', label: 'Tarjeta 2', medium: 'paper' as const, contents: [{ type: 'share' as const, key: 'k1', share: 2 }], lockedBy: [], location: 'casa' };
    const m = { ...model, artifacts: [card] };
    // Sin el móvil: la tarjeta se carga en un dispositivo en blanco y, con el robado, se empareja un móvil nuevo.
    const sinMovil = simulateAttack(m, [{ type: 'burglary', location: 'casa' }]);
    expect(sinMovil.facts.get('coordinator:k1')?.justification).toEqual({ rule: 'pair-coordinator', premises: ['unlocked:' + devices[0], 'secret:share:k1/2'] });
    expect(sinMovil.facts.has('share-sign:k1/1')).toBe(true);
    expect(sinMovil.canSpend).toBe(true);
    // La tarjeta de la misma share que el dispositivo no añade nada.
    const misma = { ...model, artifacts: [{ ...card, contents: [{ type: 'share' as const, key: 'k1', share: 1 }] }] };
    expect(simulateAttack(misma, [{ type: 'burglary', location: 'casa' }]).canSpend).toBe(false);
    // En el día a día no se cargan tarjetas: el titular, solo con un dispositivo y una tarjeta, no firma de forma segura.
    expect(derive(createWorld({ ...m, computers: [] }), { people: ['yo'], locations: ['casa'] }, 'secure').canSpend).toBe(false);
    const d = simulateAttack(m, [{ type: 'coercion', person: 'yo', location: 'casa' }]);
    expect(d.facts.get('share-sign:k1/2')?.justification.rule).toBe('share-software');
    expect(d.canSpend).toBe(true);
  });

  it('sin móviles indicados, la share del dispositivo no está protegida (ante la duda, lo peor)', () => {
    const m = setKeyCoordinators(model, 'k1', undefined);
    const d = simulateAttack(m, [{ type: 'burglary', location: 'casa' }]);
    expect(d.facts.get('share-sign:k1/1')?.justification).toEqual({ rule: 'device-share', premises: ['unlocked:' + devices[0]], via: { device: devices[0] } });
  });

  it('nunca se firma una key FROST cargando su secreto en un dispositivo, ni en el uso del día a día', () => {
    const cards = [1, 2].map((share) => ({ id: `c${share}`, label: `C${share}`, medium: 'paper' as const, contents: [{ type: 'share' as const, key: 'k1', share }], lockedBy: [], location: 'casa' }));
    const stateless = { id: 'ss', label: 'SS', vendor: 'SeedSigner', kind: 'stateless' as const, holds: [], pinProtected: false, duressPin: false, acceptsExternalSeed: true, registeredWallet: false, location: 'casa' };
    const m = { ...model, artifacts: cards, devices: [stateless], computers: [] };
    const world = createWorld(m);
    const holdings = { people: ['yo'], locations: ['casa'] };
    expect(derive(world, holdings, 'secure').canSpend).toBe(false);
    expect(derive(world, holdings, 'any').canSpend).toBe(true);
  });
});

describe('FROST: propiedades', () => {
  /** El modelo FROST de una forma, con o sin móvil emparejado (encima de alguien o guardado en una ubicación). */
  const frostArb = shapeArb(4).chain((s) =>
    fc.record({ s: fc.constant(s), phone: fc.option(fc.record({ carried: fc.boolean(), at: fc.nat(Math.max(s.nPeople, s.nLocs) - 1) })) }).map(({ s, phone }) => {
      const m = build(s, true);
      if (!phone) return m;
      const place = phone.carried ? { carriedBy: `p${phone.at % s.nPeople}` } : { location: `l${phone.at % s.nLocs}` };
      const c = addComputer(m, place);
      return setKeyCoordinators(c.model, 'f', [c.id]);
    }),
  );

  it('monotonía: tener más nunca permite hacer menos; y lo que se firma seguro, se firma de cualquier forma', () => {
    fc.assert(
      fc.property(
        frostArb.chain((m) =>
          fc.tuple(
            fc.constant(m),
            fc.subarray(m.people.map((p) => p.id)),
            fc.subarray(m.locations.map((l) => l.id)),
            fc.subarray(m.people.map((p) => p.id)),
            fc.subarray(m.locations.map((l) => l.id)),
            fc.constantFrom<SigningMode>('any', 'secure'),
          ),
        ),
        ([model, p1, l1, p2, l2, mode]) => {
          const world = createWorld(model);
          const small = derive(world, { people: p1, locations: l1 }, mode);
          const big = derive(world, { people: [...p1, ...p2], locations: [...l1, ...l2] }, mode);
          for (const id of small.facts.keys()) expect(big.facts.has(id)).toBe(true);
          if (derive(world, { people: p1, locations: l1 }, 'secure').canSpend) expect(derive(world, { people: p1, locations: l1 }, 'any').canSpend).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('emparejar un móvil nunca empeora la seguridad', () => {
    fc.assert(
      fc.property(shapeArb(3), fc.boolean(), (s, carried) => {
        const m = build(s, true);
        const c = addComputer(m, carried ? { carriedBy: 'p0' } : { location: 'l0' });
        // Sin indicar (sin protección) frente a emparejado con ese móvil: el ataque más barato cuesta lo mismo o más.
        const sin = analyze(c.model).security.minEffort ?? Infinity;
        const con = analyze(setKeyCoordinators(c.model, 'f', [c.id])).security.minEffort ?? Infinity;
        expect(con).toBeGreaterThanOrEqual(sin);
      }),
      { numRuns: 60 },
    );
  });
});
