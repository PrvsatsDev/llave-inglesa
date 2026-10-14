import { noDescriptorCopy, policyTimelocks, type CustodyModel, type Id } from '@llave-inglesa/domain';
import { attackAtoms, attackHoldings, withDuress, type AttackAtom } from './attacks.ts';
import { combinations, minimalCuts } from './cuts.ts';
import { derive, type Derivation, type SigningMode } from './derive.ts';
import { explain, type ExplanationNode } from './explain.ts';
import { factId } from './facts.ts';
import { legitHoldings, lossAtoms } from './losses.ts';
import { devicesWithoutMiniscript } from './miniscript.ts';
import { EVENTUALLY } from './policy.ts';
import { attackEffort, combinedRarity, cutRarity, EXPOSURE, inheritanceBreakdown, resilienceBreakdown, securityScore, usabilityScore } from './score.ts';
import { accessibleLocations, canAct, createWorld, eventually, type LossEvent, type World } from './world.ts';

export interface AnalyzeOptions {
  /** Tamaño máximo de combinación a explorar en los cortes. */
  maxCutSize?: number;
}

export interface CutReport<A> {
  score: number;
  /** Tamaño del corte más pequeño, o null si no hay ninguno hasta `searchedUpTo`. */
  minSize: number | null;
  searchedUpTo: number;
  /** Todos los cortes mínimos encontrados, del más barato al más caro. */
  cuts: A[][];
  /** Los cortes que determinan la puntuación (los más baratos). */
  cheapest: A[][];
}

export interface SecurityReport extends CutReport<AttackAtom> {
  /** Esfuerzo del robo más barato (suma de ATTACK_EFFORT), o null si no hay. */
  minEffort: number | null;
  /** Vías de robo igual de baratas o casi (penalizan por exposición); la llave inglesa a una misma persona en sitios distintos es una sola. */
  cheapRoutes: number;
  /** Esfuerzo de cada corte de `cuts` (mismo orden). */
  efforts: number[];
  /** Si cada corte exige vencer un PIN de coacción (mismo orden). */
  beatsDuress: boolean[];
  /** Se firma con algún ordenador o móvil de uso general (resta, ver DAILY_COMPUTER_PENALTY). */
  dailyComputer: boolean;
}

/**
 * Qué aporta el PIN de coacción de un dispositivo a la seguridad: se compara con el mismo esquema
 * sin él (las vías de robo son las mismas; solo cambia su esfuerzo).
 */
export interface DuressReport {
  device: Id;
  /** ¿Mejora la puntuación de seguridad? */
  helps: boolean;
  /** Esfuerzo del robo más barato y puntuación sin este PIN de coacción. */
  minEffortWithout: number | null;
  scoreWithout: number;
  /**
   * Si no ayuda: la vía más barata que no tiene que vencerlo (p. ej. la llave inglesa también
   * da la placa de la caja fuerte, o el robo más barato ni siquiera coacciona). null si no hay.
   */
  bypass: AttackAtom[] | null;
  /** Objetos que usa esa vía para robar (dispositivos y backups). */
  bypassItems: Id[];
}

export interface ResilienceReport {
  score: number;
  recoverableNow: boolean;
  /** Multisig sin ninguna copia del descriptor en todo el esquema (resta, ver NO_DESCRIPTOR_PENALTY). */
  noDescriptorCopy: boolean;
  searchedUpTo: number;
  /** Combinaciones mínimas que lo pierden todo para siempre, de la más probable a la menos. */
  cuts: LossEvent[][];
  /** Rareza de cada combinación de `cuts` (mismo orden). */
  rarities: number[];
  /** Rareza de la pérdida más probable, o null si no hay ninguna hasta `searchedUpTo`. */
  minRarity: number | null;
  /** Rareza equivalente de todas las vías juntas (sus probabilidades se suman). */
  combinedRarity: number | null;
  /** Las pérdidas más probables (las de rareza mínima). */
  cheapest: LossEvent[][];
  /**
   * Bloqueos temporales: combinaciones que impiden mover los fondos mientras
   * alguien está incapacitado, pero que se resuelven cuando fallece. Del más probable al menos.
   */
  lockouts: LossEvent[][];
  lockoutRarities: number[];
  lockoutMinRarity: number | null;
  /**
   * Retrasos: combinaciones que impiden mover los fondos ahora, pero que se recuperan esperando a que venza un timelock
   * (vacío sin timelocks). Del más probable al menos, con la espera de cada uno en bloques.
   */
  delays: LossEvent[][];
  delayRarities: number[];
  delayWaits: number[];
  delayMinRarity: number | null;
}

export interface InheritanceReport {
  score: number;
  /** 'no-heirs': tras el fallecimiento no queda nadie (ni herederos ni custodios) que pueda actuar. */
  status: 'ok' | 'no-heirs' | 'unrecoverable';
  /** Personas con papel de heredero que pueden actuar. */
  heirs: Id[];
  /** Personas de otro papel (custodios…) sin las que no se recupera; vacío si los herederos se bastan. */
  helpers: Id[];
  /** Ubicaciones mínimas a las que hay que ir, o null si no se recupera. */
  locations: Id[] | null;
  /** Bloques que tienen que esperar a que venza un timelock por ese camino (0 si ninguno, o si no se recupera). */
  wait: number;
  /**
   * Si ese camino exige esperar: otro sin espera, aunque cueste más visitas (las ubicaciones mínimas y sus visitas), o
   * null si no lo hay. No puntúa: es la alternativa para quien no quiera esperar.
   */
  withoutWait: { locations: Id[]; visits: number } | null;
  /** Viajes: las ubicaciones sin contar las que están dentro de otra de la lista. */
  visits: number | null;
  /**
   * Multisig: los herederos solo recuperan reconstruyendo la cartera sin descriptor (no llegan a ninguna copia ni a
   * un dispositivo con la cartera registrada que puedan desbloquear). Resta, ver NO_DESCRIPTOR_PENALTY.
   */
  rebuild: boolean;
  /**
   * Desgracias que, además del fallecimiento de los titulares, dejarían a los herederos sin los fondos,
   * de la más probable a la menos (vacío si no se recupera ni sin ellas).
   */
  losses: LossEvent[][];
  /** Rareza de cada combinación de `losses` (mismo orden). */
  lossRarities: number[];
  /** Rareza equivalente de todas juntas, o null si no hay ninguna hasta el límite buscado. */
  lossCombinedRarity: number | null;
}

export interface Analysis {
  /** ¿Qué combinación de ataques permite robar, y con qué esfuerzo? */
  security: SecurityReport;
  /** Un informe por dispositivo con PIN y PIN de coacción configurados. */
  duress: DuressReport[];
  /** ¿Qué combinación de pérdidas deja los fondos inaccesibles para siempre? */
  resilience: ResilienceReport;
  /**
   * ¿Cuántas ubicaciones tiene que visitar el titular para firmar de forma segura? `renewal`: con timelocks, hay que
   * mover las monedas cada cierto tiempo para renovarlos (resta, ver RENEWAL_PENALTY). `noMiniscript`: dispositivos que
   * no firman la cartera porque la política necesita Miniscript (resta, ver MINISCRIPT_DEVICE_PENALTY).
   */
  usability: { score: number; locations: Id[] | null; visits: number | null; renewal: boolean; noMiniscript: Id[] };
  /** Tras el fallecimiento de los titulares, ¿pueden los herederos recuperar los fondos? */
  inheritance: InheritanceReport;
}

/** ¿Qué consigue un adversario con esta combinación de ataques? */
export function simulateAttack(model: CustodyModel, atoms: readonly AttackAtom[]): Derivation {
  return attackDerivation(createWorld(model), atoms);
}

/**
 * Lo que consigue el atacante. Si el robo funciona aunque el coaccionado dé el PIN de coacción,
 * se explica por ese camino (el que no lo necesita); si no, el atacante vence el PIN de coacción.
 */
export function attackDerivation(world: World, atoms: readonly AttackAtom[]): Derivation {
  const holdings = attackHoldings(world, atoms);
  if (atoms.some((a) => a.type === 'coercion') && world.model.devices.some((d) => d.pinProtected && d.duressPin)) {
    const honest = derive(world, withDuress(world, atoms, holdings), 'any');
    if (honest.canSpend) return honest;
  }
  return derive(world, holdings, 'any');
}

/**
 * ¿Qué puede hacer la coalición legítima tras estas pérdidas, ahora mismo o con las monedas `elapsed` bloques sin
 * moverse? Con EVENTUALLY, tras vencer todos los timelocks.
 */
export function simulateLosses(model: CustodyModel, events: readonly LossEvent[], elapsed = 0): Derivation {
  const world = createWorld(model, events);
  return derive(world, legitHoldings(world, elapsed), 'any');
}

const timelocksIn = (model: CustodyModel) => policyTimelocks(model.policy).length > 0;

const activeOwners = (world: World) => world.model.people.filter((p) => p.role === 'owner' && canAct(world, p.id)).map((p) => p.id);

/** El fallecimiento de todos los titulares: el suceso del que parte la herencia. */
export function ownerDeaths(model: CustodyModel): LossEvent[] {
  return model.people.filter((p) => p.role === 'owner').map((p) => ({ type: 'death', person: p.id }));
}

/**
 * Cómo firman los titulares, de forma segura, yendo solo a `locations` (sin ubicaciones: a todas
 * las que pueden entrar). Con las de `analyze().usability.locations`, `canSpend` es cierto.
 */
export function simulateSigning(model: CustodyModel, locations?: readonly Id[]): Derivation {
  const world = createWorld(model);
  const owners = activeOwners(world);
  const reachable = locations ?? [...new Set(owners.flatMap((p) => accessibleLocations(world, p)))];
  return derive(world, { people: owners, locations: reachable }, 'secure');
}

/**
 * Qué consiguen los herederos tras fallecer los titulares yendo solo a `locations` (sin ubicaciones:
 * a todas las que pueden llegar), con `people` (sin indicar: todos los que pueden actuar).
 * Con los herederos y ayudantes del análisis, explica la puntuación de herencia.
 */
export function simulateInheritance(model: CustodyModel, locations?: readonly Id[], people?: readonly Id[], elapsed = EVENTUALLY): Derivation {
  const world = createWorld(model, ownerDeaths(model));
  const legit = legitHoldings(world, elapsed);
  const who = people ?? legit.people;
  const reachable = new Set(who.flatMap((p) => accessibleLocations(world, p)));
  return derive(world, { people: who, locations: (locations ?? legit.locations).filter((l) => reachable.has(l)), elapsed }, 'any');
}

/**
 * Herencia: las ubicaciones mínimas con las que la coalición legítima recupera los fondos tras el
 * fallecimiento de los titulares, y qué personas de otro papel hacen falta de verdad (se quita
 * cada una y se comprueba si los demás se bastan con las ubicaciones a las que aún llegan).
 */
function inheritanceReport(world: World, maxCutSize: number): InheritanceReport {
  // Fallecidos los titulares, nadie renueva: los timelocks acaban venciendo.
  const legit = legitHoldings(world, EVENTUALLY);
  const role = (id: Id) => world.model.people.find((p) => p.id === id)?.role;
  const heirs = legit.people.filter((p) => role(p) === 'heir');
  // En un multisig, mejor una vía con el descriptor (aunque cueste un viaje más: la facilidad cambia menos que la
  // penalización); si no la hay, reconstruyendo la cartera con las semillas, penalizado.
  const multisig = world.model.policy.type === 'thresh';
  const withConfig = (d: Derivation) => d.canSpend && (!multisig || knowsWallet(d));
  let locations = legit.people.length > 0 ? minimalLocationSet(world, legit.people, legit.locations, 'any', withConfig, EVENTUALLY) : null;
  let rebuild = false;
  if (multisig && legit.people.length > 0 && !locations) {
    locations = minimalLocationSet(world, legit.people, legit.locations, 'any', undefined, EVENTUALLY);
    rebuild = locations !== null;
  }
  const accept = rebuild ? (d: Derivation) => d.canSpend : withConfig;
  const status = legit.people.length === 0 ? 'no-heirs' : locations ? 'ok' : 'unrecoverable';
  let helpers = legit.people.filter((p) => role(p) !== 'heir');
  if (locations) {
    for (const p of [...helpers]) {
      const people = [...heirs, ...helpers.filter((h) => h !== p)];
      const reachable = new Set(people.flatMap((q) => accessibleLocations(world, q)));
      if (accept(derive(world, { people, locations: locations.filter((l) => reachable.has(l)), elapsed: EVENTUALLY }, 'any'))) helpers = helpers.filter((h) => h !== p);
    }
  } else {
    helpers = [];
  }
  const n = visits(world, locations);
  const wait = locations ? derive(world, { people: [...heirs, ...helpers], locations, elapsed: EVENTUALLY }, 'any').wait : 0;
  const noWait = wait > 0 ? minimalLocationSet(world, legit.people, legit.locations, 'any', accept, 0) : null;
  const withoutWait = noWait && { locations: noWait, visits: visits(world, noWait)! };

  // Fragilidad: qué más tendría que pasar, ya fallecidos los titulares, para que no lo recuperen.
  let losses: { cut: LossEvent[]; rarity: number }[] = [];
  if (locations) {
    const owners = new Set(world.model.people.filter((p) => p.role === 'owner').map((p) => p.id));
    const atoms = lossAtoms(world).filter((e) => !('person' in e && owners.has(e.person)));
    const blocked = (events: LossEvent[]) => {
      const after = createWorld(world.model, [...ownerDeaths(world.model), ...events], world.index);
      return !derive(after, legitHoldings(after, EVENTUALLY), 'any').canSpend;
    };
    losses = minimalCuts(atoms, blocked, maxCutSize)
      .map((cut) => ({ cut, rarity: cutRarity(cut, world.index) }))
      .sort((a, b) => a.rarity - b.rarity || a.cut.length - b.cut.length);
  }
  const lossCombinedRarity = combinedRarity(losses.map((l) => l.rarity));
  return {
    score: inheritanceBreakdown(n, lossCombinedRarity, rebuild).score,
    status, heirs, helpers, locations, wait, withoutWait, visits: n, rebuild,
    losses: losses.map((l) => l.cut),
    lossRarities: losses.map((l) => l.rarity),
    lossCombinedRarity,
  };
}

/** ¿Sabe cómo es la cartera (el descriptor, o un dispositivo desbloqueado con la cartera registrada)? */
function knowsWallet(d: Derivation): boolean {
  return d.has({ kind: 'secret', secret: { type: 'descriptor' } }) || [...d.facts.values()].some((f) => f.justification.rule === 'device-wallet');
}


/** Viajes necesarios para ir a `locations`: la caja fuerte de casa se abre en la misma visita a casa. */
export function visits(world: World, locations: readonly Id[] | null): number | null {
  return locations && locations.filter((l) => world.index.locations.get(l)?.inside === undefined).length;
}

/**
 * Conjunto mínimo de ubicaciones con el que `people` puede gastar, o null si no hay. Minimiza las
 * visitas: cada una es una ubicación junto con las que tiene dentro.
 */
export function minimalLocationSet(
  world: World,
  people: readonly Id[],
  candidates: readonly Id[],
  mode: SigningMode,
  accept: (d: Derivation) => boolean = (d) => d.canSpend,
  elapsed = 0,
): Id[] | null {
  // Se cuentan visitas: entrar en casa incluye abrir la caja fuerte que hay dentro.
  const visits = candidates.filter((l) => world.index.locations.get(l)?.inside === undefined);
  const within = (visit: Id) => [visit, ...candidates.filter((l) => world.index.locations.get(l)?.inside === visit)];
  for (let size = 0; size <= visits.length; size++) {
    for (const combo of combinations(visits.length, size)) {
      const chosen = combo.map((i) => visits[i]!);
      const locations = chosen.flatMap(within);
      if (accept(derive(world, { people, locations, elapsed }, mode))) return locations;
    }
  }
  return null;
}

/** ¿Este robo solo funciona si el coaccionado da el PIN real de un dispositivo con PIN de coacción? */
function needsDuressPin(world: World, cut: readonly AttackAtom[]): boolean {
  return duressObstacles(world, cut).length > 0;
}

/**
 * PINs de coacción que el atacante tiene que vencer para que el robo funcione: el coaccionado
 * sabe el PIN de ese dispositivo y podría dar el de coacción. Vacío si el robo no depende de ello.
 */
export function duressObstacles(world: World, cut: readonly AttackAtom[]): { person: Id; device: Id }[] {
  if (!cut.some((a) => a.type === 'coercion')) return [];
  if (!world.model.devices.some((d) => d.pinProtected && d.duressPin)) return [];
  const holdings = withDuress(world, cut, attackHoldings(world, cut));
  if (derive(world, holdings, 'any').canSpend) return [];
  const knowsPin = (person: Id, device: Id) =>
    world.model.people.some((p) => p.id === person && p.knows.some((s) => s.type === 'pin' && s.device === device));
  return (holdings.withheldPins ?? []).filter((w) => knowsPin(w.person, w.device));
}

/**
 * Quita los robos que solo se distinguen de otro en esperar más: con dos timelocks, esperar al largo también vale, pero
 * es la misma vía con más espera.
 */
function withoutLongerWaits(cuts: AttackAtom[][]): AttackAtom[][] {
  const waitOf = (cut: AttackAtom[]) => cut.find((a) => a.type === 'timelock-wait');
  const rest = (cut: AttackAtom[]) => cut.filter((a) => a.type !== 'timelock-wait').map((a) => JSON.stringify(a)).sort().join('|');
  return cuts.filter((cut) => {
    const wait = waitOf(cut);
    if (wait?.type !== 'timelock-wait') return true;
    return !cuts.some((other) => {
      const w = waitOf(other);
      return w?.type === 'timelock-wait' && w.blocks < wait.blocks && rest(other) === rest(cut);
    });
  });
}

function securityReport(world: World, found: AttackAtom[][], searchedUpTo: number): SecurityReport {
  const cuts = withoutLongerWaits(found)
    .map((cut) => {
      const beatsDuress = needsDuressPin(world, cut);
      return { cut, beatsDuress, effort: attackEffort(cut, world.index, beatsDuress) };
    })
    .sort((a, b) => a.effort - b.effort || a.cut.length - b.cut.length);
  const minEffort = cuts[0]?.effort ?? null;
  // La llave inglesa a una misma persona es un solo ataque: el atacante elige dónde hacerla.
  const route = (cut: AttackAtom[]) => cut.map((a) => (a.type === 'coercion' ? `coercion:${a.person}` : JSON.stringify(a))).sort().join('|');
  const cheapRoutes = minEffort === null ? 0 : new Set(cuts.filter((c) => c.effort <= minEffort + EXPOSURE.margin).map((c) => route(c.cut))).size;
  const dailyComputer = world.model.computers.some((c) => c.use === 'daily');
  return {
    score: securityScore(minEffort, cheapRoutes, dailyComputer),
    minSize: found.length ? Math.min(...found.map((c) => c.length)) : null,
    searchedUpTo,
    cuts: cuts.map((c) => c.cut),
    cheapest: cuts.filter((c) => c.effort === minEffort).map((c) => c.cut),
    minEffort,
    cheapRoutes,
    efforts: cuts.map((c) => c.effort),
    beatsDuress: cuts.map((c) => c.beatsDuress),
    dailyComputer,
  };
}

/** Objetos que intervienen en el robo con estos ataques (dando el coaccionado el PIN de coacción). */
function usedItems(world: World, atoms: readonly AttackAtom[]): Id[] {
  const tree = explain(attackDerivation(world, atoms), factId({ kind: 'spend' }));
  const items: Id[] = [];
  const walk = (n: ExplanationNode) => {
    if (n.fact.kind === 'item' && !items.includes(n.fact.item)) items.push(n.fact.item);
    n.children.forEach(walk);
  };
  if (tree) walk(tree);
  return items;
}

/** Para cada PIN de coacción, la seguridad con y sin él. */
function duressReports(model: CustodyModel, intact: World, security: SecurityReport): DuressReport[] {
  return model.devices
    .filter((d) => d.pinProtected && d.duressPin)
    .map((d) => {
      const without = createWorld({ ...model, devices: model.devices.map((x) => (x.id === d.id ? { ...x, duressPin: false } : x)) });
      const alt = securityReport(without, security.cuts, security.searchedUpTo);
      const helps = alt.score !== security.score || alt.minEffort !== security.minEffort;
      const bypass = helps
        ? null
        : (security.cuts.find((cut, i) => security.efforts[i] === security.minEffort && !duressObstacles(intact, cut).some((o) => o.device === d.id)) ?? null);
      return { device: d.id, helps, minEffortWithout: alt.minEffort, scoreWithout: alt.score, bypass, bypassItems: bypass ? usedItems(intact, bypass) : [] };
    });
}

export function analyze(model: CustodyModel, options: AnalyzeOptions = {}): Analysis {
  const maxCutSize = options.maxCutSize ?? 3;
  const intact = createWorld(model);

  const security = securityReport(
    intact,
    minimalCuts(attackAtoms(intact), (atoms) => derive(intact, attackHoldings(intact, atoms), 'any').canSpend, maxCutSize),
    maxCutSize,
  );

  const recoverable = (events: readonly LossEvent[], elapsed = 0) => {
    const world = createWorld(model, events, intact.index);
    return derive(world, legitHoldings(world, elapsed), 'any').canSpend;
  };
  // Si nadie puede gastar, nadie puede renovar: los timelocks acaban venciendo. Permanente: ni así ni cuando las
  // personas incapacitadas acaben falleciendo.
  const lostForever = (events: LossEvent[]) => !recoverable(events, EVENTUALLY) && !recoverable(eventually(events), EVENTUALLY);
  const blockedEvenWaiting = (events: LossEvent[]) => !recoverable(events, EVENTUALLY);
  const blockedNow = (events: LossEvent[]) => !recoverable(events);
  const timelocks = policyTimelocks(model.policy).length > 0;

  const recoverableNow = recoverable([]);
  let resilience: ResilienceReport;
  if (recoverableNow) {
    const atoms = lossAtoms(intact);
    const byRarity = (cuts: LossEvent[][]) =>
      cuts.map((cut) => ({ cut, rarity: cutRarity(cut, intact.index) })).sort((a, b) => a.rarity - b.rarity || a.cut.length - b.cut.length);
    const losses = byRarity(minimalCuts(atoms, lostForever, maxCutSize));
    const lockouts = byRarity(minimalCuts(atoms, blockedEvenWaiting, maxCutSize).filter((cut) => !lostForever(cut)));
    const delays = timelocks ? byRarity(minimalCuts(atoms, blockedNow, maxCutSize).filter((cut) => !blockedEvenWaiting(cut))) : [];
    const delayMinRarity = delays[0]?.rarity ?? null;
    const waitAfter = (cut: LossEvent[]) => {
      const world = createWorld(model, cut, intact.index);
      return derive(world, legitHoldings(world, EVENTUALLY), 'any').wait;
    };
    const minRarity = losses[0]?.rarity ?? null;
    const combined = combinedRarity(losses.map((l) => l.rarity));
    const lockoutMinRarity = lockouts[0]?.rarity ?? null;
    const noCopy = noDescriptorCopy(model);
    resilience = {
      score: resilienceBreakdown(minRarity, combined, lockoutMinRarity, noCopy, delayMinRarity).score,
      recoverableNow,
      noDescriptorCopy: noCopy,
      searchedUpTo: maxCutSize,
      cuts: losses.map((l) => l.cut),
      rarities: losses.map((l) => l.rarity),
      minRarity,
      combinedRarity: combined,
      cheapest: losses.filter((l) => l.rarity === minRarity).map((l) => l.cut),
      lockouts: lockouts.map((l) => l.cut),
      lockoutRarities: lockouts.map((l) => l.rarity),
      lockoutMinRarity,
      delays: delays.map((l) => l.cut),
      delayRarities: delays.map((l) => l.rarity),
      delayWaits: delays.map((l) => waitAfter(l.cut)),
      delayMinRarity,
    };
  } else {
    resilience = {
      score: 0, recoverableNow, noDescriptorCopy: noDescriptorCopy(model), searchedUpTo: 0, cuts: [[]], rarities: [0], minRarity: 0, combinedRarity: 0, cheapest: [[]],
      lockouts: [], lockoutRarities: [], lockoutMinRarity: null, delays: [], delayRarities: [], delayWaits: [], delayMinRarity: null,
    };
  }

  const owners = activeOwners(intact);
  const ownerLocations = [...new Set(owners.flatMap((p) => accessibleLocations(intact, p)))];
  const usableWith = minimalLocationSet(intact, owners, ownerLocations, 'secure');
  const usableVisits = visits(intact, usableWith);
  const noMiniscript = devicesWithoutMiniscript(model);

  const inheritance = inheritanceReport(createWorld(model, ownerDeaths(model), intact.index), maxCutSize);

  return {
    security,
    duress: duressReports(model, intact, security),
    resilience,
    usability: {
      score: usabilityScore(usableVisits, timelocksIn(model), noMiniscript.length > 0),
      locations: usableWith,
      visits: usableVisits,
      renewal: timelocksIn(model),
      noMiniscript,
    },
    inheritance,
  };
}
