import { flatPolicy, miniscriptSupport, policyKeys, signsMiniscript, taprootSupport, walletOf, type CustodyModel, type Id } from '@llave-inglesa/domain';
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

/**
 * Lo mismo con una cartera Taproot (`tr`): dispositivos que firman alguna key de la política y no firman Taproot.
 * Null si la cartera no es Taproot (así los modelos de antes no cambian). Cuesta lo mismo: TAPROOT_DEVICE_PENALTY.
 */
export function devicesWithoutTaproot(model: CustodyModel): Id[] | null {
  if (walletOf(model).script !== 'tr') return null;
  const keys = new Set(policyKeys(model.policy));
  const seeds = seedKeys(model);
  return model.devices.filter((d) => keysUsedOn(d, seeds).some((k) => keys.has(k)) && !signsMiniscript(taprootSupport(d))).map((d) => d.id);
}
