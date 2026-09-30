/**
 * Catálogo de hardware wallets y de avisos de seguridad conocidos.
 *
 * Solo datos estructurados: los textos (descripciones, consejos) viven en
 * `packages/text`, indexados por id. La app es offline y no puede actualizar
 * el catálogo sola: `CATALOG_DATE` indica hasta cuándo está al día.
 */

export const CATALOG_DATE = '2026-09-30';

/** Comportamiento ante un PIN de coacción: abre otro wallet (señuelo) o borra/inutiliza el dispositivo. */
export type DuressKind = 'decoy' | 'wipe';

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
  duress: readonly DuressKind[];
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
  duress: [],
  ...opts,
});

const TREZOR = { duress: ['wipe'] } as const; // wipe code
const LEDGER = { registersMultisig: true, duress: ['decoy'] } as const; // passphrase ligada a un segundo PIN
const COLDCARD = { registersMultisig: true, duress: ['decoy', 'wipe'] } as const; // duress PIN y brick-me PIN
const JADE = { registersMultisig: true, acceptsExternalSeed: true, antiExfil: true, duress: ['wipe'] } as const;
const STATELESS = { kind: 'stateless', acceptsExternalSeed: true } as const;

export const HARDWARE_MODELS: readonly CatalogModel[] = [
  model('trezor-one', 'Trezor', 'Trezor Model One', { ...TREZOR, discontinued: true }),
  model('trezor-model-t', 'Trezor', 'Trezor Model T', { ...TREZOR, discontinued: true }),
  model('trezor-safe-3', 'Trezor', 'Trezor Safe 3', TREZOR),
  model('trezor-safe-5', 'Trezor', 'Trezor Safe 5', TREZOR),
  model('trezor-safe-7', 'Trezor', 'Trezor Safe 7', TREZOR),

  model('ledger-nano-s', 'Ledger', 'Ledger Nano S', { ...LEDGER, discontinued: true }),
  model('ledger-nano-s-plus', 'Ledger', 'Ledger Nano S Plus', LEDGER),
  model('ledger-nano-x', 'Ledger', 'Ledger Nano X', LEDGER),
  model('ledger-nano-gen5', 'Ledger', 'Ledger Nano Gen5', LEDGER),
  model('ledger-flex', 'Ledger', 'Ledger Flex', LEDGER),
  model('ledger-stax', 'Ledger', 'Ledger Stax', LEDGER),

  model('coldcard-mk2', 'Coinkite', 'Coldcard Mk2', { ...COLDCARD, discontinued: true }),
  model('coldcard-mk3', 'Coinkite', 'Coldcard Mk3', { ...COLDCARD, discontinued: true }),
  model('coldcard-mk4', 'Coinkite', 'Coldcard Mk4', { ...COLDCARD, acceptsExternalSeed: true }),
  model('coldcard-mk5', 'Coinkite', 'Coldcard Mk5', { ...COLDCARD, acceptsExternalSeed: true }),
  model('coldcard-q', 'Coinkite', 'Coldcard Q', { ...COLDCARD, acceptsExternalSeed: true }),
  model('tapsigner', 'Coinkite', 'Tapsigner'),

  model('bitbox01', 'BitBox', 'BitBox01', { discontinued: true }),
  model('bitbox02', 'BitBox', 'BitBox02', { registersMultisig: true, antiExfil: true }),
  model('bitbox02-nova', 'BitBox', 'BitBox02 Nova', { registersMultisig: true, antiExfil: true }),

  model('passport', 'Foundation', 'Passport', { registersMultisig: true }),
  model('passport-prime', 'Foundation', 'Passport Prime', { registersMultisig: true }),

  model('jade', 'Blockstream', 'Jade', JADE),
  model('jade-plus', 'Blockstream', 'Jade Plus', JADE),

  model('bitkey', 'Block', 'Bitkey'),

  model('seedsigner', 'SeedSigner', 'SeedSigner', STATELESS),
  model('krux', 'Krux', 'Krux', STATELESS),
  model('specter-diy', 'Specter', 'Specter DIY', { ...STATELESS, registersMultisig: true }),

  model('keystone-essential', 'Keystone', 'Keystone Essential', { registersMultisig: true, discontinued: true }),
  model('keystone-pro', 'Keystone', 'Keystone Pro', { registersMultisig: true, discontinued: true }),
  model('keystone-3-pro', 'Keystone', 'Keystone 3 Pro', { registersMultisig: true }),
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
  /** Mezclar al menos `minRolls` tiradas de dado propias al generar la semilla. */
  | { type: 'dice'; minRolls: number }
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
    mitigations: [{ type: 'dice', minRolls: 50 }, { type: 'passphrase' }],
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

// ---------- Versiones de firmware ----------

/**
 * Parte numérica de una versión: "5.6.0" → [5,6,0]; también "1.5.0Q", "6.6.0QX", "5.0.3-mk3".
 * null si no empieza por un número.
 */
export function parseFirmware(version: string): number[] | null {
  const m = /^\s*v?(\d+(?:\.\d+)*)/i.exec(version);
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

export interface AdvisoryMatch {
  advisory: Advisory;
  /** false: no se sabe el firmware y el modelo tiene versiones afectadas (ante la duda, lo peor). */
  certain: boolean;
}

/** Avisos que afectan a un modelo con un firmware dado (o desconocido). */
export function advisoriesFor(modelId: string, firmware?: string): AdvisoryMatch[] {
  const version = firmware ? parseFirmware(firmware) : null;
  const matches: AdvisoryMatch[] = [];
  for (const advisory of ADVISORIES) {
    const ranges = advisory.affects.filter((r) => r.models.includes(modelId));
    if (ranges.length === 0) continue;
    const unfixable = ranges.some((r) => !r.from && !r.fixedIn);
    if (unfixable) matches.push({ advisory, certain: true });
    else if (!version) matches.push({ advisory, certain: false });
    else if (ranges.some((r) => inRange(version, r))) matches.push({ advisory, certain: true });
  }
  return matches;
}
