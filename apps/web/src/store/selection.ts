import type { Id } from '@llave-inglesa/domain';
import { create } from 'zustand';

export type SelectionKind = 'location' | 'person' | 'device' | 'artifact' | 'key';
export type Selection = { kind: SelectionKind; id: Id };

interface SelectionState {
  selected: Selection | null;
  select(selection: Selection | null): void;
}

/** Qué entidad se está inspeccionando. Separado del documento: no entra en el historial. */
export const useSelection = create<SelectionState>()((set) => ({
  selected: null,
  select: (selected) => set({ selected }),
}));

export const isSelected = (s: Selection | null, kind: SelectionKind, id: Id) => s !== null && s.kind === kind && s.id === id;
