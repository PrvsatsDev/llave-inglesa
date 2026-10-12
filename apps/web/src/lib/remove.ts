import { removeArtifact, removeDevice, removeKey, removeLocation, removePerson, type CustodyModel } from '@llave-inglesa/domain';
import { confirmDialog } from '../store/dialog.ts';
import { useDocument } from '../store/document.ts';
import { useSelection, type Selection } from '../store/selection.ts';
import { UI } from './text.ts';

const T = UI.ubicacion;

/** Objetos (dispositivos y backups) que se borran con la ubicación. */
export const itemsAt = (model: CustodyModel, location: string) =>
  model.devices.filter((d) => d.location === location).length + model.artifacts.filter((a) => a.location === location).length;

/** ¿Se puede eliminar? Siempre tiene que quedar una key, un titular y una ubicación. */
export function canRemove(model: CustodyModel, s: Selection): boolean {
  switch (s.kind) {
    case 'key':
      return model.keys.length > 1;
    case 'location':
      return model.locations.length > 1;
    case 'person':
      return model.people.some((p) => p.id !== s.id && p.role === 'owner');
    default:
      return true;
  }
}

/**
 * Elimina el elemento (desde el botón de su ficha o con Supr) y cierra su ficha. Una ubicación con objetos pide
 * confirmación, porque se los lleva con ella. Se puede deshacer.
 */
export async function removeElement(s: Selection): Promise<void> {
  const { model, apply } = useDocument.getState();
  if (!canRemove(model, s)) return;
  if (s.kind === 'location') {
    const n = itemsAt(model, s.id);
    const name = model.locations.find((l) => l.id === s.id)?.name ?? '';
    // Lo que está dentro (una caja fuerte) no se borra: queda suelto.
    const inside = model.locations.filter((l) => l.inside === s.id).map((l) => l.name);
    const message = T.confirmarEliminar.mensaje(n, inside);
    if (n > 0 && !(await confirmDialog(T.confirmarEliminar.titulo(name), message, T.eliminarCon(n), true))) return;
  }
  const edit = {
    key: removeKey,
    location: removeLocation,
    person: removePerson,
    device: removeDevice,
    artifact: removeArtifact,
  }[s.kind];
  apply((m) => edit(m, s.id));
  const selection = useSelection.getState();
  // Cierra su ficha si estaba abierta (desde el mapa, la ficha es la única del camino).
  if (selection.selected?.kind === s.kind && selection.selected.id === s.id) selection.back();
}
