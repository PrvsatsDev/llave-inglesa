import { advisoriesFor, catalogModelByName, type Computer, type CustodyModel, type Device, type Id } from '@llave-inglesa/domain';
import { keysUsedOn, seedKeys } from './firmware.ts';

/**
 * Malware en un ordenador de firma: lee la cartera (el descriptor) y ataca los dispositivos que se le conectan por
 * cable o Bluetooth con un fallo publicado explotable desde el ordenador (`host-exploit`). Ante la duda, el fallo
 * da la semilla de las keys que pasan por el dispositivo.
 */

/** Dispositivos que se conectan al ordenador (sin indicar: todos). */
export const connectedDevices = (model: CustodyModel, computer: Computer): Device[] =>
  computer.connects ? model.devices.filter((d) => computer.connects!.includes(d.id)) : model.devices;

/** Aviso `host-exploit` que afecta al dispositivo con su firmware actual, o null. */
export function hostExploitAdvisory(device: Device): string | null {
  const catalog = catalogModelByName(device.model);
  if (!catalog) return null;
  return advisoriesFor(catalog.id, device.firmware).find((m) => m.advisory.kind === 'host-exploit')?.advisory.id ?? null;
}

export interface HostExploit {
  device: Id;
  advisory: string;
  /** Keys que pasan por el dispositivo: las que filtraría. */
  keys: Id[];
}

/** Dispositivos conectados al ordenador que un malware suyo puede explotar. */
export function hostExploits(model: CustodyModel, computer: Computer): HostExploit[] {
  const seeds = seedKeys(model);
  return connectedDevices(model, computer).flatMap((d) => {
    const advisory = hostExploitAdvisory(d);
    const keys = advisory ? keysUsedOn(d, seeds) : [];
    return advisory && keys.length > 0 ? [{ device: d.id, advisory, keys }] : [];
  });
}

/** Ordenadores en los que un malware consigue algo: la cartera o algún dispositivo explotable. */
export const malwareTargets = (model: CustodyModel): Computer[] => model.computers.filter((c) => c.wallet || hostExploits(model, c).length > 0);
