import { flatPolicy, miniscriptSupport, policyKeys, signsMiniscript, type CustodyModel, type Id } from '@llave-inglesa/domain';
import { keysUsedOn, seedKeys } from './firmware.ts';

/**
 * Dispositivos que no pueden firmar la cartera: la política necesita Miniscript (tiene espera o umbrales anidados) y
 * su modelo, o su firmware, no lo firma. Solo los que firman alguna key de la política. No cambia qué se puede hacer
 * (se compra otro dispositivo y se carga la semilla), solo cuesta usabilidad: ver MINISCRIPT_DEVICE_PENALTY.
 */
export function devicesWithoutMiniscript(model: CustodyModel): Id[] {
  if (flatPolicy(model)) return [];
  const keys = new Set(policyKeys(model.policy));
  const seeds = seedKeys(model);
  return model.devices.filter((d) => keysUsedOn(d, seeds).some((k) => keys.has(k)) && !signsMiniscript(miniscriptSupport(d))).map((d) => d.id);
}
