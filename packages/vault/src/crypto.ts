/**
 * Cifrado de documentos con contraseña, solo con WebCrypto (navegador y Node ≥ 20).
 *
 * - Clave: PBKDF2-SHA256 sobre la contraseña (NFKC), sal aleatoria de 16 bytes.
 * - Cifrado: AES-256-GCM, IV aleatorio de 12 bytes por cada guardado.
 * - La cabecera (formato, versión, parámetros) va como datos adicionales autenticados:
 *   si alguien la manipula (p. ej. baja las iteraciones), el descifrado falla.
 */

export const ENVELOPE_FORMAT = 'llave-inglesa-cifrado' as const;
/** Recomendación OWASP para PBKDF2-SHA256. */
export const DEFAULT_ITERATIONS = 600_000;
const MAX_ITERATIONS = 10_000_000;

export interface Envelope {
  format: typeof ENVELOPE_FORMAT;
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  /** Texto cifrado en base64. */
  data: string;
}

type AesKey = Awaited<ReturnType<SubtleCrypto['deriveKey']>>;

/** Clave derivada, reutilizable durante la sesión para volver a guardar sin pedir la contraseña. */
export interface VaultKey {
  readonly key: AesKey;
  readonly salt: Uint8Array<ArrayBuffer>;
  readonly iterations: number;
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Contraseña incorrecta o fichero dañado');
    this.name = 'WrongPasswordError';
  }
}

const subtle = () => globalThis.crypto.subtle;
const encode = (s: string) => new TextEncoder().encode(s);
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Datos autenticados: la cabecera en un orden fijo. */
function header(env: Omit<Envelope, 'data'>): Uint8Array<ArrayBuffer> {
  const { format, version, kdf, cipher } = env;
  return encode(
    JSON.stringify({
      format,
      version,
      kdf: { name: kdf.name, hash: kdf.hash, iterations: kdf.iterations, salt: kdf.salt },
      cipher: { name: cipher.name, iv: cipher.iv },
    }),
  );
}

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<VaultKey> {
  const base = await subtle().importKey('raw', encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { key, salt, iterations };
}

/** Clave nueva (sal nueva) a partir de una contraseña. */
export function createKey(password: string, iterations = DEFAULT_ITERATIONS): Promise<VaultKey> {
  return deriveKey(password, random(16), iterations);
}

export async function seal(plaintext: string, vault: VaultKey): Promise<Envelope> {
  const meta: Omit<Envelope, 'data'> = {
    format: ENVELOPE_FORMAT,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: vault.iterations, salt: toBase64(vault.salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(random(12)) },
  };
  const ciphertext = await subtle().encrypt(
    { name: 'AES-GCM', iv: fromBase64(meta.cipher.iv), additionalData: header(meta) },
    vault.key,
    encode(plaintext),
  );
  return { ...meta, data: toBase64(new Uint8Array(ciphertext)) };
}

/** Descifra con la contraseña. Devuelve también la clave, para poder volver a guardar. */
export async function unseal(env: Envelope, password: string): Promise<{ plaintext: string; vault: VaultKey }> {
  const { iterations } = env.kdf;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) throw new WrongPasswordError();
  const vault = await deriveKey(password, fromBase64(env.kdf.salt), iterations);
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(env.cipher.iv), additionalData: header(env) },
      vault.key,
      fromBase64(env.data),
    );
    return { plaintext: new TextDecoder().decode(plain), vault };
  } catch {
    throw new WrongPasswordError();
  }
}

export function isEnvelope(x: unknown): x is Envelope {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Partial<Envelope>;
  return (
    e.format === ENVELOPE_FORMAT &&
    e.version === 1 &&
    e.kdf?.name === 'PBKDF2' &&
    e.kdf.hash === 'SHA-256' &&
    typeof e.kdf.iterations === 'number' &&
    typeof e.kdf.salt === 'string' &&
    e.cipher?.name === 'AES-GCM' &&
    typeof e.cipher.iv === 'string' &&
    typeof e.data === 'string'
  );
}
