import { z } from 'zod';

/**
 * Formato de documento de un esquema de custodia.
 *
 * Principio: aquí NUNCA hay material secreto real (semillas, claves privadas,
 * passphrases). Solo describimos QUÉ existe, DÓNDE está y QUIÉN lo sabe.
 */

export const IdSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);
export type Id = z.infer<typeof IdSchema>;

/** Referencia a un secreto (o dato sensible) que un actor puede llegar a poseer. */
export const SecretRefSchema = z.discriminatedUnion('type', [
  /** Palabras BIP39 de una key. */
  z.object({ type: z.literal('seed'), key: IdSchema }),
  /** Passphrase BIP39 ("palabra 25") de una key. */
  z.object({ type: z.literal('passphrase'), key: IdSchema }),
  /** Clave pública extendida de una key (necesaria para construir transacciones multisig). */
  z.object({ type: z.literal('xpub'), key: IdSchema }),
  /** PIN de un dispositivo. */
  z.object({ type: z.literal('pin'), device: IdSchema }),
  /** Descriptor / configuración del wallet: contiene la política y todas las xpubs. */
  z.object({ type: z.literal('descriptor') }),
  /** Contraseña con la que está cifrado un backup (p. ej. un fichero en la nube). */
  z.object({ type: z.literal('password'), artifact: IdSchema }),
]);
export type SecretRef = z.infer<typeof SecretRefSchema>;

/**
 * Política de gasto como árbol (subconjunto de Miniscript).
 * Hoy: `key` y `thresh`. Los timelocks (`after`/`older`) se añadirán como nodos nuevos.
 */
export type Policy = { type: 'key'; key: Id } | { type: 'thresh'; k: number; of: Policy[] };
export const PolicySchema: z.ZodType<Policy> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('key'), key: IdSchema }),
    z.object({ type: z.literal('thresh'), k: z.number().int().min(1), of: z.array(PolicySchema).min(1) }),
  ]),
);

export const EntropySourceSchema = z.discriminatedUnion('kind', [
  /** RNG hardware de un dispositivo (TRNG del elemento seguro, etc.). */
  z.object({ kind: z.literal('device-rng'), vendor: z.string().min(1), model: z.string().optional() }),
  /** RNG de un software (Sparrow, Bitcoin Core…). */
  z.object({ kind: z.literal('software-rng'), vendor: z.string().min(1), model: z.string().optional() }),
  z.object({ kind: z.literal('dice'), count: z.number().int().positive().optional() }),
  z.object({ kind: z.literal('coin'), count: z.number().int().positive().optional() }),
  z.object({ kind: z.literal('cards'), count: z.number().int().positive().optional() }),
  z.object({ kind: z.literal('unknown') }),
]);
export type EntropySource = z.infer<typeof EntropySourceSchema>;

export const ProvenanceSchema = z.object({
  /** Fuentes de entropía mezcladas para generar la semilla. */
  sources: z.array(EntropySourceSchema).min(1),
  /** Dispositivo/software que mezcló la entropía y derivó la semilla. Ausente = calculada a mano. */
  generatedBy: z
    .object({
      vendor: z.string().min(1),
      model: z.string().optional(),
      /** Firmware con el que se GENERÓ la semilla (el que cuenta para los avisos de entropía). */
      firmware: z.string().optional(),
    })
    .optional(),
  /** La derivación se comprobó con una herramienta independiente (p. ej. dados verificados en otro equipo). */
  independentlyVerified: z.boolean().default(false),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const KeySchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
  fingerprint: z.string().regex(/^[0-9a-fA-F]{8}$/).optional(),
  /** La key requiere passphrase BIP39 además de la semilla. */
  passphrase: z.boolean().default(false),
  provenance: ProvenanceSchema.default({ sources: [{ kind: 'unknown' }], independentlyVerified: false }),
});
export type Key = z.infer<typeof KeySchema>;

export const DeviceSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
  vendor: z.string().min(1),
  model: z.string().optional(),
  /** Versión de firmware instalada ahora. */
  firmware: z.string().optional(),
  /** stateful: guarda keys dentro (Coldcard, Jade…). stateless: hay que cargarle la semilla (SeedSigner…). */
  kind: z.enum(['stateful', 'stateless']),
  /** Keys que guarda en memoria (solo stateful). */
  holds: z.array(IdSchema).default([]),
  /** Protegido por PIN. Por defecto `false`: ante la duda, asumimos lo peor. */
  pinProtected: z.boolean().default(false),
  /** Puede firmar con una semilla cargada temporalmente. Implícito en los stateless. */
  acceptsExternalSeed: z.boolean().default(false),
  /** Tiene registrada la configuración multisig (y por tanto todas las xpubs). */
  registeredWallet: z.boolean().default(false),
  location: IdSchema,
});
export type Device = z.infer<typeof DeviceSchema>;

export const ArtifactSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
  medium: z.enum(['paper', 'metal', 'washers', 'digital', 'other']),
  contents: z.array(SecretRefSchema).min(1),
  /** Secretos necesarios para leer el contenido (p. ej. un backup cifrado). */
  lockedBy: z.array(SecretRefSchema).default([]),
  location: IdSchema,
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const PersonSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  role: z.enum(['owner', 'heir', 'custodian', 'other']),
  /** Lo que sabe de memoria. */
  knows: z.array(SecretRefSchema).default([]),
});
export type Person = z.infer<typeof PersonSchema>;

export const AccessConditionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('always') }),
  /** Solo tras el fallecimiento de alguien (p. ej. caja del banco para herederos). */
  z.object({ type: z.literal('after-death'), person: IdSchema }),
  /** Si esa persona queda incapacitada o fallece (poder notarial preventivo, tutela…). */
  z.object({ type: z.literal('incapacity-or-death'), person: IdSchema }),
]);
export type AccessCondition = z.infer<typeof AccessConditionSchema>;

export const LocationSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  /**
   * physical: casa, banco… (intrusión / incendio).
   * device: portátil, disco (robo o malware / avería).
   * cloud: cuenta en la nube (hackeo remoto / pérdida de la cuenta).
   */
  kind: z.enum(['physical', 'device', 'cloud']).default('physical'),
  access: z
    .array(z.object({ person: IdSchema, when: AccessConditionSchema.default({ type: 'always' }) }))
    .default([]),
});
export type Location = z.infer<typeof LocationSchema>;

export const CustodyModelSchema = z.object({
  format: z.literal('llave-inglesa'),
  version: z.literal(1),
  name: z.string().min(1),
  description: z.string().optional(),
  keys: z.array(KeySchema).min(1),
  policy: PolicySchema,
  devices: z.array(DeviceSchema).default([]),
  artifacts: z.array(ArtifactSchema).default([]),
  people: z.array(PersonSchema).min(1),
  locations: z.array(LocationSchema).min(1),
});
/** Modelo normalizado (con valores por defecto aplicados). */
export type CustodyModel = z.infer<typeof CustodyModelSchema>;
/** Modelo tal y como se escribe en JSON (campos con default opcionales). */
export type CustodyModelInput = z.input<typeof CustodyModelSchema>;
