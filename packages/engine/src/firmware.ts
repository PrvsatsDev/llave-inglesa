import { catalogModelByName, walletOf, type CustodyModel, type Device, type Id, type SecretRef } from '@llave-inglesa/domain';

/**
 * Firmware malicioso de un fabricante (actualización maliciosa o fabricante comprometido).
 * Filtra la semilla dentro de las firmas (Dark Skippy): basta con firmar una vez, sin
 * conexión alguna, porque las firmas acaban publicadas. Alcanza a toda key que se use en
 * sus dispositivos, se generara como se generara. Solo lo mitiga el anti-exfil.
 */

const vendorKey = (vendor: string) => vendor.trim().toLowerCase();

/**
 * Keys cuyas semillas tienen escritas o memorizadas: las que podrían cargarse en un stateless. En Shamir, también las
 * que tienen escritas o memorizadas al menos k shares distintas (juntándolas sale la semilla); en FROST no, porque no
 * hay semilla que cargar.
 */
export function seedKeys(model: CustodyModel): Set<Id> {
  const keys = new Set<Id>();
  const shares = new Map<Id, Set<number>>();
  const add = (s: SecretRef) => {
    if (s.type === 'seed') keys.add(s.key);
    if (s.type === 'share') shares.set(s.key, (shares.get(s.key) ?? new Set()).add(s.share));
  };
  model.artifacts.forEach((a) => a.contents.forEach(add));
  model.people.forEach((p) => p.knows.forEach(add));
  for (const k of model.keys) {
    if (k.split?.scheme === 'shamir' && (shares.get(k.id)?.size ?? 0) >= k.split.k) keys.add(k.id);
  }
  return keys;
}

/** Keys que pasan por un dispositivo al firmar. */
export function keysUsedOn(device: Device, allSeeds: ReadonlySet<Id>): Id[] {
  const held = device.kind === 'stateful' ? device.holds : [];
  // Stateless sin indicar: ante la duda, cualquier semilla puede pasar por él.
  // Semilla externa en un stateful: solo si se indica (poder no es hacerlo).
  const loaded = device.kind === 'stateless' ? (device.loads ?? [...allSeeds]) : device.acceptsExternalSeed ? (device.loads ?? []) : [];
  return [...new Set([...held, ...loaded])];
}

/**
 * Anti-exfil del modelo. Con una cartera Taproot (firmas Schnorr) solo cuenta si el catálogo dice que también las
 * protege: en muchos modelos solo existe para las firmas de SegWit.
 */
export function hasAntiExfil(device: Device, model: CustodyModel): boolean {
  const catalog = catalogModelByName(device.model);
  if (!catalog?.antiExfil) return false;
  return walletOf(model).script !== 'tr' || catalog.taproot?.antiExfil === true;
}

/** Por fabricante (nombre tal cual aparece), las keys que filtraría un firmware malicioso suyo. */
export function firmwareExposure(model: CustodyModel): Map<string, { vendor: string; keys: Id[] }> {
  const allSeeds = seedKeys(model);
  const found = new Map<string, { vendor: string; keys: Id[] }>();
  for (const device of model.devices) {
    if (hasAntiExfil(device, model)) continue;
    const keys = keysUsedOn(device, allSeeds);
    if (keys.length === 0) continue;
    const k = vendorKey(device.vendor);
    const entry = found.get(k) ?? { vendor: device.vendor, keys: [] };
    entry.keys = [...new Set([...entry.keys, ...keys])];
    found.set(k, entry);
  }
  return found;
}

/** Dispositivos por los que un firmware malicioso de `vendor` filtraría alguna semilla. */
export function firmwareDevices(model: CustodyModel, vendor: string): Id[] {
  const allSeeds = seedKeys(model);
  return model.devices
    .filter((d) => vendorKey(d.vendor) === vendorKey(vendor) && !hasAntiExfil(d, model) && keysUsedOn(d, allSeeds).length > 0)
    .map((d) => d.id);
}
