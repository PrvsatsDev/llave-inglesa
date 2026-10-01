import type { Id } from '@llave-inglesa/domain';
import { create } from 'zustand';

export type SelectionKind = 'location' | 'person' | 'device' | 'artifact' | 'key';
export type Selection = { kind: SelectionKind; id: Id };

interface SelectionState {
  /** La ficha abierta: siempre el último elemento de `trail`. */
  selected: Selection | null;
  /** Fichas por las que se ha llegado a la actual (migas de pan), de la primera a la última. */
  trail: Selection[];
  /** Abre una ficha desde cero (desde el mapa o desde una lista de la sección). */
  select(selection: Selection | null): void;
  /** Abre una ficha desde otra (p. ej. un dispositivo desde su ubicación): "volver" regresa a la anterior. */
  open(selection: Selection): void;
  /** Vuelve a la ficha anterior, o cierra la ficha si era la primera. */
  back(): void;
  /** Vuelve a una ficha de las migas de pan (por posición). */
  backTo(index: number): void;
}

const same = (a: Selection, b: Selection) => a.kind === b.kind && a.id === b.id;

/** Qué entidad se está inspeccionando. Separado del documento: no entra en el historial. */
export const useSelection = create<SelectionState>()((set, get) => {
  const setTrail = (trail: Selection[]) => set({ trail, selected: trail.at(-1) ?? null });
  return {
    selected: null,
    trail: [],
    select: (selection) => setTrail(selection ? [selection] : []),
    open: (selection) => {
      const trail = get().trail;
      // Si ya estaba en el camino, se vuelve a ella en vez de repetirla.
      const at = trail.findIndex((s) => same(s, selection));
      setTrail(at >= 0 ? trail.slice(0, at + 1) : [...trail, selection]);
    },
    back: () => setTrail(get().trail.slice(0, -1)),
    backTo: (index) => setTrail(get().trail.slice(0, index + 1)),
  };
});

export const isSelected = (s: Selection | null, kind: SelectionKind, id: Id) => s !== null && s.kind === kind && s.id === id;
