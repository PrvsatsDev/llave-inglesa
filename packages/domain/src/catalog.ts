/**
 * Catálogo de hardware wallets y de avisos de seguridad conocidos.
 *
 * Solo datos estructurados: los textos (descripciones, consejos) viven en
 * `packages/text`, indexados por id. La app es offline y no puede actualizar
 * el catálogo sola: `CATALOG_DATE` indica hasta cuándo está al día.
 */

export const CATALOG_DATE = '2026-10-31';

/** Comportamiento ante un PIN de coacción: abre otro wallet (señuelo) o borra/inutiliza el dispositivo. */
export type DuressKind = 'decoy' | 'wipe';

/**
 * Matices de un modelo que no cambian el análisis pero hay que contar (los textos, en packages/text):
 * - same-vendor-coordinator: su anti-exfil cuenta con la aleatoriedad que pone la app del móvil, que es del mismo
 *   fabricante; un fabricante malicioso controla los dos extremos.
 */
export type CatalogNote = 'same-vendor-coordinator';

/** Desde qué firmware se admite algo (`since`, si se sabe) y si solo con el firmware experimental Edge (Coldcard). */
export interface FirmwareSupport {
  since?: string;
  edge?: true;
}

export interface CatalogModel {
  id: string;
  /** Fabricante: agrupa el riesgo de RNG o firmware malicioso de toda la marca. */
  vendor: string;
  /** Nombre visible, con la marca (p. ej. "Coldcard Mk4"). */
  name: string;
  /** Valor por defecto: algunos modelos pueden funcionar de las dos formas. */
  kind: 'stateful' | 'stateless';
  discontinued: boolean;
  /** Puede firmar con una semilla cargada temporalmente, sin guardarla. */
  acceptsExternalSeed: boolean;
  /** Puede registrar la configuración multisig (y guarda así todas las xpubs). */
  registersMultisig: boolean;
  /** Implementa anti-exfil / anti-klepto: un firmware malicioso no puede filtrar la semilla en las firmas. */
  antiExfil: boolean;
  /** Se puede montar en casa con piezas compradas por separado (sin que el fabricante toque el aparato). */
  diy: boolean;
  /** Se protege con PIN. Frostsnap no: lo protege el bloqueo del móvil emparejado. */
  pin: boolean;
  /** Guarda shares de keys FROST (y solo eso: no guarda semillas). */
  frost: boolean;
  notes: readonly CatalogNote[];
  /**
   * Firma carteras Miniscript en P2WSH (las políticas con espera). `since`: firmware mínimo, si se sabe; `edge`: solo
   * con el firmware experimental Edge (Coldcard), que el fabricante desaconseja para cantidades grandes. Null: no.
   */
  miniscript: FirmwareSupport | null;
  /**
   * Firma carteras Taproot: `singleSig`, una sola key sin árbol de scripts (`tr(KEY)`, BIP-86); `miniscript`, Miniscript
   * en las hojas de tapscript. Lo que no está, no lo firma. `antiExfil`: su anti-exfil también protege las firmas
   * Schnorr de Taproot (en muchos modelos solo existe para las de SegWit: BitBox02, p. ej., lo dice así). Sin él, con
   * una cartera Taproot el anti-exfil del modelo no cuenta. Null: Taproot, nada.
   */
  taproot: { singleSig?: FirmwareSupport; miniscript?: FirmwareSupport; antiExfil?: true } | null;
  duress: readonly DuressKind[];
  /**
   * Series de firmware conocidas (`from` incluido, `before` excluido). Si se definen,
   * una versión fuera de todas no se da por buena: probablemente sea de otro modelo.
   */
  firmwareLines?: readonly { from: string; before: string }[];
}

const model = (
  id: string,
  vendor: string,
  name: string,
  opts: Partial<Omit<CatalogModel, 'id' | 'vendor' | 'name'>> = {},
): CatalogModel => ({
  id,
  vendor,
  name,
  kind: 'stateful',
  discontinued: false,
  acceptsExternalSeed: false,
  registersMultisig: false,
  antiExfil: false,
  diy: false,
  pin: true,
  frost: false,
  notes: [],
  miniscript: null,
  taproot: null,
  duress: [],
  ...opts,
});

// Taproot (single-sig) desde diciembre de 2021: 2.4.3 (Model T) y 1.10.4 (Model One); los Safe, siempre.
const TREZOR = { duress: ['wipe'], taproot: { singleSig: {} } } as const; // wipe code
// Miniscript con la app de Bitcoin 2.1 (2023): la versión es de la app, no del firmware.
// Taproot single-sig con la app 2.0; Miniscript en tapscript con la app 2.2.0 (2024). Como arriba, versiones de la app.
const LEDGER = { registersMultisig: true, miniscript: {}, taproot: { singleSig: {}, miniscript: {} }, duress: ['decoy'] } as const; // passphrase ligada a un segundo PIN
const COLDCARD = { registersMultisig: true, duress: ['decoy', 'wipe'] } as const; // duress PIN y brick-me PIN
// Taproot single-sig (BIP-86) desde la 1.0.34 (marzo de 2025); su anti-exfil no dice nada de Schnorr.
const JADE = { registersMultisig: true, acceptsExternalSeed: true, antiExfil: true, miniscript: {}, taproot: { singleSig: { since: '1.0.34' } }, duress: ['wipe'] } as const;
/** Coldcard: serie normal y serie Edge (…X / …QX). */
/** Coldcard: Miniscript solo en la serie Edge, desde la 6.1.0X. */
const COLDCARD_MINISCRIPT = { since: '6.1.0', edge: true } as const;
/** Coldcard: Taproot también solo en Edge (la serie normal, hasta la 5.6, no lo firma): 6.0.0X y Miniscript en tapscript en la 6.1.0X. */
const COLDCARD_TAPROOT = { singleSig: { since: '6.0.0', edge: true }, miniscript: COLDCARD_MINISCRIPT } as const;
const coldcardLines = (normal: string, normalBefore: string) => [
  { from: normal, before: normalBefore },
  { from: '6.0.0', before: '7.0.0' },
];

const STATELESS = { kind: 'stateless', acceptsExternalSeed: true } as const;

export const HARDWARE_MODELS: readonly CatalogModel[] = [
  model('trezor-one', 'Trezor', 'Trezor Model One', { ...TREZOR, discontinued: true, taproot: { singleSig: { since: '1.10.4' } } }),
  model('trezor-model-t', 'Trezor', 'Trezor Model T', { ...TREZOR, discontinued: true, taproot: { singleSig: { since: '2.4.3' } } }),
  model('trezor-safe-3', 'Trezor', 'Trezor Safe 3', TREZOR),
  model('trezor-safe-5', 'Trezor', 'Trezor Safe 5', TREZOR),
  model('trezor-safe-7', 'Trezor', 'Trezor Safe 7', TREZOR),

  model('ledger-nano-s', 'Ledger', 'Ledger Nano S', { ...LEDGER, miniscript: null, taproot: { singleSig: {} }, discontinued: true }),
  model('ledger-nano-s-plus', 'Ledger', 'Ledger Nano S Plus', LEDGER),
  model('ledger-nano-x', 'Ledger', 'Ledger Nano X', LEDGER),
  model('ledger-nano-gen5', 'Ledger', 'Ledger Nano Gen5', LEDGER),
  model('ledger-flex', 'Ledger', 'Ledger Flex', LEDGER),
  model('ledger-stax', 'Ledger', 'Ledger Stax', LEDGER),

  model('coldcard-mk2', 'Coinkite', 'Coldcard Mk2', { ...COLDCARD, discontinued: true }),
  model('coldcard-mk3', 'Coinkite', 'Coldcard Mk3', { ...COLDCARD, discontinued: true }),
  model('coldcard-mk4', 'Coinkite', 'Coldcard Mk4', { ...COLDCARD, acceptsExternalSeed: true, miniscript: COLDCARD_MINISCRIPT, taproot: COLDCARD_TAPROOT, firmwareLines: coldcardLines('5.0.0', '6.0.0') }),
  model('coldcard-mk5', 'Coinkite', 'Coldcard Mk5', { ...COLDCARD, acceptsExternalSeed: true, miniscript: COLDCARD_MINISCRIPT, taproot: COLDCARD_TAPROOT, firmwareLines: coldcardLines('5.0.0', '6.0.0') }),
  model('coldcard-q', 'Coinkite', 'Coldcard Q', { ...COLDCARD, acceptsExternalSeed: true, miniscript: COLDCARD_MINISCRIPT, taproot: COLDCARD_TAPROOT, firmwareLines: coldcardLines('1.0.0', '2.0.0') }),
  model('tapsigner', 'Coinkite', 'Tapsigner'),

  model('bitbox01', 'BitBox', 'BitBox01', { discontinued: true }),
  // Taproot single-sig desde la 9.10.0, sin anti-klepto («no soportado para Taproot por usar firmas Schnorr»).
  model('bitbox02', 'BitBox', 'BitBox02', { registersMultisig: true, antiExfil: true, miniscript: {}, taproot: { singleSig: { since: '9.10.0' } } }),
  model('bitbox02-nova', 'BitBox', 'BitBox02 Nova', { registersMultisig: true, antiExfil: true, miniscript: {}, taproot: { singleSig: {} } }),

  model('passport', 'Foundation', 'Passport', { registersMultisig: true, taproot: { singleSig: { since: '2.3.0' } } }),
  model('passport-prime', 'Foundation', 'Passport Prime', { registersMultisig: true }),

  model('jade', 'Blockstream', 'Jade', JADE),
  model('jade-plus', 'Blockstream', 'Jade Plus', JADE),

  model('bitkey', 'Block', 'Bitkey'),

  model('seedsigner', 'SeedSigner', 'SeedSigner', { ...STATELESS, diy: true, taproot: { singleSig: { since: '0.6.0' } } }),
  model('krux', 'Krux', 'Krux', { ...STATELESS, diy: true, miniscript: { since: '25.03.0' }, taproot: { singleSig: { since: '25.03.0' }, miniscript: { since: '25.03.0' } } }),
  // Taproot single-sig estable desde la 1.8.0 (experimental en la 1.6.0); Miniscript en tapscript desde la 1.9.0.
  model('specter-diy', 'Specter', 'Specter DIY', { ...STATELESS, registersMultisig: true, diy: true, miniscript: { since: '1.5.0' }, taproot: { singleSig: { since: '1.8.0' }, miniscript: { since: '1.9.0' } } }),

  model('keystone-essential', 'Keystone', 'Keystone Essential', { registersMultisig: true, discontinued: true }),
  model('keystone-pro', 'Keystone', 'Keystone Pro', { registersMultisig: true, discontinued: true }),
  // Taproot desde la 1.3.0 (firmware solo Bitcoin), y de momento solo con Sparrow.
  // Frostsnap: FROST con DKG, sin PIN ni secure element (el móvil emparejado guarda la clave que descifra cada share),
  // anti-exfil en cada firma con la aleatoriedad del móvil (anti-klepto), firmware firmado y reproducible. Solo
  // Taproot con una sola key; no firma hojas de tapscript.
  model('frostsnap', 'Frostsnap', 'Frostsnap', {
    antiExfil: true,
    taproot: { singleSig: {}, antiExfil: true },
    pin: false,
    frost: true,
    notes: ['same-vendor-coordinator'],
  }),

  model('keystone-3-pro', 'Keystone', 'Keystone 3 Pro', { registersMultisig: true, taproot: { singleSig: { since: '1.3.0' } } }),
];

/**
 * - weak-entropy: la semilla generada con ese firmware es predecible (importa el firmware
 *   con el que se GENERÓ, no el actual: actualizar no la arregla).
 * - physical-extraction: con el dispositivo en la mano se puede sacar la semilla pese al PIN.
 * - host-exploit: un ordenador/móvil con malware conectado puede atacar el dispositivo.
 * - supply-chain: el dispositivo puede llegar manipulado sin que se detecte.
 */
export type AdvisoryKind = 'weak-entropy' | 'physical-extraction' | 'host-exploit' | 'supply-chain';

export type Mitigation =
  /** Mezclar al menos `minBits` de entropía propia (dados, moneda, cartas) al generar la semilla. */
  | { type: 'own-entropy'; minBits: number }
  /** Passphrase BIP39: no se guarda en el dispositivo. */
  | { type: 'passphrase' }
  /** Usar el dispositivo solo por QR (sin USB ni Bluetooth). */
  | { type: 'qr-only' };

/** Rango de firmware afectado: `from` incluido, `fixedIn` excluido. Sin `fixedIn`: sin arreglo por firmware. */
export interface FirmwareRange {
  models: readonly string[];
  from?: string;
  fixedIn?: string;
}

export interface Advisory {
  id: string;
  kind: AdvisoryKind;
  /** Fecha de publicación (AAAA-MM-DD). */
  disclosed: string;
  /** Se ha explotado para robar fondos. */
  exploited: boolean;
  affects: readonly FirmwareRange[];
  mitigations: readonly Mitigation[];
  sources: readonly string[];
}

export const ADVISORIES: readonly Advisory[] = [
  {
    id: 'coldcard-rng-2026',
    kind: 'weak-entropy',
    disclosed: '2026-07-30',
    exploited: true,
    affects: [
      { models: ['coldcard-mk2', 'coldcard-mk3'], from: '4.0.1', fixedIn: '4.2.0' },
      { models: ['coldcard-mk3'], from: '5.0.1', fixedIn: '5.0.4' }, // 5.0.1-mk3 y 5.0.3-mk3
      { models: ['coldcard-mk4', 'coldcard-mk5'], fixedIn: '5.6.0' },
      { models: ['coldcard-q'], fixedIn: '1.5.0' },
      { models: ['coldcard-mk4', 'coldcard-mk5', 'coldcard-q'], from: '6.0.0', fixedIn: '6.6.0' }, // Edge (…X, …QX)
    ],
    mitigations: [{ type: 'own-entropy', minBits: 128 }, { type: 'passphrase' }], // 50 dados ≈ 129 bits
    sources: [
      'https://blog.coinkite.com/coldcard-mk3-seed-generation-warning/',
      'https://engineering.block.xyz/blog/predictable-rng-fallback-and-32-bit-reseed-in-coldcard-firmware',
      'https://wizardsardine.com/blog/coldcard-rng-vulnerability/',
    ],
  },
  {
    id: 'trezor-glitch-2020',
    kind: 'physical-extraction',
    disclosed: '2020-01-31',
    exploited: false,
    affects: [{ models: ['trezor-one', 'trezor-model-t'] }],
    mitigations: [{ type: 'passphrase' }],
    sources: ['https://www.theblock.co/post/54631/kraken-security-labs-hackers-can-exploit-trezor-hardware-wallets-with-only-15-minutes-of-physical-access-to-the-device'],
  },
  {
    id: 'trezor-safe3-donjon-2025',
    kind: 'supply-chain',
    disclosed: '2025-03-12',
    exploited: false,
    affects: [{ models: ['trezor-safe-3'] }],
    mitigations: [],
    sources: ['https://trezor.io/es/vulnerability/donjon-s-trezor-safe-3-evaluation'],
  },
  {
    id: 'jade-register-descriptor-2025',
    kind: 'host-exploit',
    disclosed: '2025-11-13',
    exploited: false,
    affects: [{ models: ['jade', 'jade-plus'], from: '1.0.24', fixedIn: '1.0.37' }],
    mitigations: [{ type: 'qr-only' }],
    sources: ['https://blog.blockstream.com/jade-security-disclosure/'],
  },
  {
    id: 'bitbox02-2026-08',
    kind: 'host-exploit',
    disclosed: '2026-08-17',
    exploited: false,
    affects: [{ models: ['bitbox02', 'bitbox02-nova'], fixedIn: '9.26.5' }],
    mitigations: [],
    sources: ['https://cointelegraph.com/news/bitbox-patches-severe-wallet-firmware-flaws'],
  },
];

export const findModel = (id: string): CatalogModel | undefined => HARDWARE_MODELS.find((m) => m.id === id);

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Modelo del catálogo por su nombre (sin distinguir mayúsculas ni espacios).
 * Los documentos guardan el nombre, no el id: así siguen valiendo los escritos a mano.
 */
export function catalogModelByName(name: string | undefined): CatalogModel | undefined {
  if (!name) return undefined;
  const n = normalizeName(name);
  return HARDWARE_MODELS.find((m) => normalizeName(m.name) === n);
}

// ---------- Versiones de firmware ----------

/**
 * Parte numérica de una versión: "5.6.0" → [5,6,0]; también "1.5.0Q", "6.6.0QX", "5.0.3-mk3".
 * null si no es una versión completa (x.y.z): "5" o "5.6" no bastan para saber si está corregida.
 */
export function parseFirmware(version: string): number[] | null {
  const m = /^\s*v?(\d+\.\d+\.\d+(?:\.\d+)*)/i.exec(version);
  return m ? m[1]!.split('.').map(Number) : null;
}

export function compareFirmware(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

function inRange(v: readonly number[], r: FirmwareRange): boolean {
  if (r.from && compareFirmware(v, parseFirmware(r.from)!) < 0) return false;
  if (r.fixedIn && compareFirmware(v, parseFirmware(r.fixedIn)!) >= 0) return false;
  return true;
}

/**
 * - affected: la versión está en un rango afectado (o no hay arreglo por firmware).
 * - unknown-firmware: no se indica la versión y el modelo tiene versiones afectadas.
 * - unrecognized-firmware: la versión está incompleta o no es de ninguna serie conocida del modelo.
 * En los dos últimos casos se asume lo peor.
 */
export type MatchReason = 'affected' | 'unknown-firmware' | 'unrecognized-firmware';

export interface AdvisoryMatch {
  advisory: Advisory;
  reason: MatchReason;
}

function recognized(v: readonly number[], lines: CatalogModel['firmwareLines']): boolean {
  return !lines || lines.some((l) => compareFirmware(v, parseFirmware(l.from)!) >= 0 && compareFirmware(v, parseFirmware(l.before)!) < 0);
}

/** Avisos que afectan a un modelo con un firmware dado (o desconocido). */
export function advisoriesFor(modelId: string, firmware?: string): AdvisoryMatch[] {
  const given = !!firmware?.trim();
  const version = given ? parseFirmware(firmware!) : null;
  const known = version !== null && recognized(version, findModel(modelId)?.firmwareLines);
  const matches: AdvisoryMatch[] = [];
  for (const advisory of ADVISORIES) {
    const ranges = advisory.affects.filter((r) => r.models.includes(modelId));
    if (ranges.length === 0) continue;
    const unfixable = ranges.some((r) => !r.from && !r.fixedIn);
    if (unfixable) matches.push({ advisory, reason: 'affected' });
    else if (!given) matches.push({ advisory, reason: 'unknown-firmware' });
    else if (!known) matches.push({ advisory, reason: 'unrecognized-firmware' });
    else if (ranges.some((r) => inRange(version, r))) matches.push({ advisory, reason: 'affected' });
  }
  return matches;
}

// ---------- Miniscript ----------

/**
 * Si un dispositivo firma una cartera Miniscript. Se sabe por el catálogo: un modelo que no está en él (escrito a mano)
 * se da por bueno, porque no hay con qué comprobarlo.
 * - yes: lo firma (o no se sabe el modelo: `unknown-model`).
 * - edge: solo con el firmware Edge; con un firmware de la serie normal ya indicado, `old-firmware`.
 * - unsupported: el modelo no firma Miniscript.
 * - old-firmware: el firmware indicado es anterior al primero que lo firma.
 */
export type MiniscriptSupport = 'yes' | 'unknown-model' | 'edge' | 'unsupported' | 'old-firmware';

function firmwareSupport(device: { model?: string; firmware?: string }, of: (c: CatalogModel) => FirmwareSupport | null | undefined): MiniscriptSupport {
  const catalog = catalogModelByName(device.model);
  if (!catalog) return 'unknown-model';
  const support = of(catalog);
  if (!support) return 'unsupported';
  const version = device.firmware?.trim() ? parseFirmware(device.firmware) : null;
  if (support.since && version && compareFirmware(version, parseFirmware(support.since)!) < 0) return 'old-firmware';
  return support.edge ? 'edge' : 'yes';
}

export const miniscriptSupport = (device: { model?: string; firmware?: string }) => firmwareSupport(device, (c) => c.miniscript);

export const signsMiniscript = (s: MiniscriptSupport) => s !== 'unsupported' && s !== 'old-firmware';

/** Lo mismo que `miniscriptSupport`, para Taproot con una sola key (`tr(KEY)`). */
export const taprootSupport = (device: { model?: string; firmware?: string }) => firmwareSupport(device, (c) => c.taproot?.singleSig);
