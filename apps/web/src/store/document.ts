import type { CustodyModel } from '@llave-inglesa/domain';
import { create } from 'zustand';
import { examples } from '../lib/examples.ts';

export type DocumentOrigin = { kind: 'example'; id: string };

const HISTORY_LIMIT = 200;

interface DocumentState {
  model: CustodyModel;
  origin: DocumentOrigin;
  past: CustodyModel[];
  future: CustodyModel[];
  /** Clave de la última edición, para agrupar pulsaciones seguidas en un solo paso de historial. */
  lastMergeKey: string | null;
  /**
   * Aplica una edición pura. Si `mergeKey` coincide con el de la edición anterior
   * (p. ej. escribir en el mismo campo), no se crea un paso nuevo de deshacer.
   */
  apply(edit: (model: CustodyModel) => CustodyModel, mergeKey?: string): void;
  undo(): void;
  redo(): void;
  loadExample(id: string): void;
}

const first = examples[0]!;

/** El documento que se está editando. Única fuente de verdad del modelo en la UI. */
export const useDocument = create<DocumentState>()((set, get) => ({
  model: first.model,
  origin: { kind: 'example', id: first.id },
  past: [],
  future: [],
  lastMergeKey: null,

  apply: (edit, mergeKey) => {
    const { model, past, lastMergeKey } = get();
    const next = edit(model);
    if (next === model) return;
    const merge = mergeKey !== undefined && mergeKey === lastMergeKey;
    set({
      model: next,
      past: merge ? past : [...past, model].slice(-HISTORY_LIMIT),
      future: [],
      lastMergeKey: mergeKey ?? null,
    });
  },

  undo: () => {
    const { model, past, future } = get();
    const previous = past.at(-1);
    if (!previous) return;
    set({ model: previous, past: past.slice(0, -1), future: [model, ...future], lastMergeKey: null });
  },

  redo: () => {
    const { model, past, future } = get();
    const [next, ...rest] = future;
    if (!next) return;
    set({ model: next, past: [...past, model], future: rest, lastMergeKey: null });
  },

  loadExample: (id) => {
    const example = examples.find((e) => e.id === id);
    if (example) set({ model: example.model, origin: { kind: 'example', id }, past: [], future: [], lastMergeKey: null });
  },
}));
