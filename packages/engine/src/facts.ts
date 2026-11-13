import type { Id, SecretRef } from '@llave-inglesa/domain';
import type { EntropyOrigin } from './entropy.ts';
import type { TamperReason } from './score.ts';

/** Hechos que el motor puede derivar para un actor. */
export type Fact =
  | { kind: 'item'; item: Id }
  | { kind: 'secret'; secret: SecretRef }
  | { kind: 'unlocked'; device: Id }
  | { kind: 'sign'; key: Id }
  /** Key FROST: se puede firmar la parte de la share número `share` (falta juntar k partes). */
  | { kind: 'share-sign'; key: Id; share: number }
  /** Key FROST: se tiene un coordinador, la clave con la que sus dispositivos descifran su share y aceptan pedir firmas. */
  | { kind: 'coordinator'; key: Id }
  /** Las monedas llevan al menos `blocks` bloques sin moverse: vence el timelock de esa rama. */
  | { kind: 'timelock'; blocks: number }
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
    case 'password':
      return `password:${s.artifact}`;
    case 'descriptor':
      return 'descriptor';
    case 'share':
      return `share:${s.key}/${s.share}`;
  }
}

export function factId(f: Fact): FactId {
  switch (f.kind) {
    case 'item': return `item:${f.item}`;
    case 'secret': return `secret:${secretId(f.secret)}`;
    case 'unlocked': return `unlocked:${f.device}`;
    case 'sign': return `sign:${f.key}`;
    case 'share-sign': return `share-sign:${f.key}/${f.share}`;
    case 'coordinator': return `coordinator:${f.key}`;
    case 'timelock': return `timelock:${f.blocks}`;
    case 'spend': return 'spend';
  }
}

export type RuleId =
  /** Objeto presente en una ubicación a la que el actor accede. */
  | 'location-access'
  /** Objeto que lleva encima una persona que colabora (o es coaccionada). */
  | 'carried'
  /** Descriptor guardado en la cartera de un ordenador de firma. */
  | 'computer-wallet'
  /** Descriptor leído de la cartera por un malware del ordenador. */
  | 'computer-malware'
  /** Semilla regalada por un dispositivo manipulado antes de llegar (segunda mano, precinto roto…). */
  | 'tampered-device'
  /** Semilla sacada de un dispositivo con un fallo publicado, desde el ordenador con malware al que se conecta. */
  | 'host-exploit'
  /** Secreto memorizado por una persona que colabora (o es coaccionada). */
  | 'memory'
  /** Secreto obtenido sin acceso físico (p. ej. RNG comprometido). */
  | 'entropy-compromise'
  /** Semilla adivinable por un fallo de entropía publicado. */
  | 'known-weak-entropy'
  /** Semilla de solo entropía propia por debajo del estándar, adivinada por fuerza bruta. */
  | 'weak-own-entropy'
  /** Semilla extraída del hardware de un dispositivo robado, pese al PIN. */
  | 'physical-extraction'
  /** Semilla filtrada en las firmas por un firmware malicioso. */
  | 'malicious-firmware'
  /** Passphrase adivinada por fuerza bruta a partir de la semilla. */
  | 'passphrase-bruteforce'
  /**
   * Key repartida: con k shares distintas se reconstruye el secreto completo (`seed:K`). En Shamir es la semilla; en
   * FROST, el secreto que nunca existió junto (herramientas como frostsnap-thaw lo reconstruyen).
   */
  | 'combine-shares'
  /** FROST: un móvil u ordenador emparejado con la key, en la mano (`item`). */
  | 'paired-coordinator'
  /** FROST: el malware de un móvil u ordenador emparejado usa su clave (`item`). */
  | 'coordinator-malware'
  /**
   * FROST: con k shares distintas de la key se empareja un coordinador nuevo: dispositivos que las guardan o, solo en
   * modo `any`, tarjetas en claro cargadas en un dispositivo en blanco (cualquier mezcla).
   */
  | 'pair-coordinator'
  /** FROST: el dispositivo firma la parte de su share (con un coordinador, si la key los tiene). */
  | 'device-share'
  /** FROST, solo en modo `any`: la share en claro (un backup) firma su parte en software o en un dispositivo en blanco. */
  | 'share-software'
  /** FROST: k partes de shares distintas forman la firma de la key. */
  | 'frost-sign'
  /** FROST: el coordinador conoce la xpub de la key (los dispositivos no la guardan). */
  | 'coordinator-xpub'
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
  /** Ha pasado el tiempo del timelock sin que nadie mueva las monedas (`blocks` en `via`). */
  | 'timelock-expired'
  | 'spend';

export interface Justification {
  rule: RuleId;
  /** Hechos de los que depende (siempre derivados antes: el grafo es acíclico). */
  premises: FactId[];
  via?: { location?: Id; person?: Id; item?: Id; device?: Id; origins?: EntropyOrigin[]; advisory?: string; vendor?: string; strength?: 'weak' | 'phrase'; bits?: number; blocks?: number; tamper?: TamperReason };
}

export interface DerivedFact {
  fact: Fact;
  justification: Justification;
}
