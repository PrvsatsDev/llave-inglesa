import type { Id, SecretRef } from '@llave-inglesa/domain';
import type { EntropyOrigin } from './entropy.ts';

/** Hechos que el motor puede derivar para un actor. */
export type Fact =
  | { kind: 'item'; item: Id }
  | { kind: 'secret'; secret: SecretRef }
  | { kind: 'unlocked'; device: Id }
  | { kind: 'sign'; key: Id }
  | { kind: 'spend' };

export type FactId = string;

export function secretId(s: SecretRef): string {
  switch (s.type) {
    case 'seed':
    case 'passphrase':
    case 'xpub':
      return `${s.type}:${s.key}`;
    case 'pin':
      return `pin:${s.device}`;
    case 'descriptor':
      return 'descriptor';
  }
}

export function factId(f: Fact): FactId {
  switch (f.kind) {
    case 'item': return `item:${f.item}`;
    case 'secret': return `secret:${secretId(f.secret)}`;
    case 'unlocked': return `unlocked:${f.device}`;
    case 'sign': return `sign:${f.key}`;
    case 'spend': return 'spend';
  }
}

export type RuleId =
  /** Objeto presente en una ubicación a la que el actor accede. */
  | 'location-access'
  /** Secreto memorizado por una persona que colabora (o es coaccionada). */
  | 'memory'
  /** Secreto obtenido sin acceso físico (p. ej. RNG comprometido). */
  | 'entropy-compromise'
  | 'read-artifact'
  | 'descriptor-xpubs'
  | 'unlock-device'
  | 'device-sign'
  | 'device-xpub'
  | 'device-wallet'
  | 'seed-xpub'
  /** Firmar con la semilla en cualquier software (lo que haría un ladrón). */
  | 'seed-sign'
  /** Firmar cargando la semilla en un dispositivo de firma (uso legítimo seguro). */
  | 'seed-sign-on-device'
  | 'spend';

export interface Justification {
  rule: RuleId;
  /** Hechos de los que depende (siempre derivados antes: el grafo es acíclico). */
  premises: FactId[];
  via?: { location?: Id; person?: Id; item?: Id; device?: Id; origins?: EntropyOrigin[] };
}

export interface DerivedFact {
  fact: Fact;
  justification: Justification;
}
