import type { CustodyModel } from '@llave-inglesa/domain';
import { create } from 'zustand';
import { examples } from '../lib/examples.ts';

/** De dónde viene el documento abierto. */
export type DocumentOrigin =
  | { kind: 'example'; id: string }
  | { kind: 'new' }
  | { kind: 'file'; name: string }
  | { kind: 'local' };

const HISTORY_LIMIT = 200;

interface DocumentState {
  model: CustodyModel;
  origin: DocumentOrigin;
  /** Se incrementa con cada documento abierto: remonta el lienzo (layout y encuadre nuevos). */
  generation: number;
  /** Última versión guardada (en este navegador). null si nunca se ha guardado. */
  saved: CustodyModel | null;
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
  /** Abre un documento: reinicia historial y estado de guardado. */
  open(model: CustodyModel, origin: DocumentOrigin, saved?: boolean): void;
  loadExample(id: string): void;
  markSaved(): void;
}

const first = examples[0]!;

/** El documento que se está editando. Única fuente de verdad del modelo en la UI. */
export const useDocument = create<DocumentState>()((set, get) => ({
  model: first.model,
  origin: { kind: 'example', id: first.id },
  generation: 0,
  saved: null,
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

  open: (model, origin, saved = false) =>
    set((s) => ({
      model,
      origin,
      generation: s.generation + 1,
      saved: saved ? model : null,
      past: [],
      future: [],
      lastMergeKey: null,
    })),

  loadExample: (id) => {
    const example = examples.find((e) => e.id === id);
    if (example) get().open(example.model, { kind: 'example', id });
  },

  markSaved: () => set((s) => ({ saved: s.model, origin: { kind: 'local' } })),
}));

/**
 * ¿Hay cambios que se perderían al cerrar? Los ejemplos sin tocar no cuentan.
 * (Comparación por referencia: cada edición crea un modelo nuevo.)
 */
export function hasUnsavedChanges(s: Pick<DocumentState, 'model' | 'saved' | 'origin' | 'past'>): boolean {
  if (s.saved) return s.model !== s.saved;
  return s.origin.kind !== 'example' || s.past.length > 0;
}
