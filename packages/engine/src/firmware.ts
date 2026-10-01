import { catalogModelByName, type CustodyModel, type Device, type Id } from '@llave-inglesa/domain';

/**
 * Firmware malicioso de un fabricante (actualización maliciosa o fabricante comprometido).
 * Filtra la semilla dentro de las firmas (Dark Skippy): basta con firmar una vez, sin
 * conexión alguna, porque las firmas acaban publicadas. Alcanza a toda key que se use en
 * sus dispositivos, se generara como se generara. Solo lo mitiga el anti-exfil.
 */

const vendorKey = (vendor: string) => vendor.trim().toLowerCase();

/** Keys cuyas semillas tienen escritas o memorizadas: las que podrían cargarse en un stateless. */
function seedKeys(model: CustodyModel): Set<Id> {
  const keys = new Set<Id>();
  const add = (s: { type: string; key?: Id }) => {
    if (s.type === 'seed' && s.key) keys.add(s.key);
  };
  model.artifacts.forEach((a) => a.contents.forEach(add));
  model.people.forEach((p) => p.knows.forEach(add));
  return keys;
}

/** Keys que pasan por un dispositivo al firmar. */
function keysUsedOn(device: Device, allSeeds: ReadonlySet<Id>): Id[] {
  const held = device.kind === 'stateful' ? device.holds : [];
  // Stateless sin indicar: ante la duda, cualquier semilla puede pasar por él.
  // Semilla externa en un stateful: solo si se indica (poder no es hacerlo).
  const loaded = device.kind === 'stateless' ? (device.loads ?? [...allSeeds]) : device.acceptsExternalSeed ? (device.loads ?? []) : [];
  return [...new Set([...held, ...loaded])];
}

export const hasAntiExfil = (device: Device) => catalogModelByName(device.model)?.antiExfil ?? false;

/** Por fabricante (nombre tal cual aparece), las keys que filtraría un firmware malicioso suyo. */
export function firmwareExposure(model: CustodyModel): Map<string, { vendor: string; keys: Id[] }> {
  const allSeeds = seedKeys(model);
  const found = new Map<string, { vendor: string; keys: Id[] }>();
  for (const device of model.devices) {
    if (hasAntiExfil(device)) continue;
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
    .filter((d) => vendorKey(d.vendor) === vendorKey(vendor) && !hasAntiExfil(d) && keysUsedOn(d, allSeeds).length > 0)
    .map((d) => d.id);
}
