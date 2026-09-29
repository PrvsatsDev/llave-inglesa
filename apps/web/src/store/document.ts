import type { CustodyModel } from '@llave-inglesa/domain';
import { create } from 'zustand';
import { examples } from '../lib/examples.ts';

export type DocumentOrigin = { kind: 'example'; id: string };

interface DocumentState {
  model: CustodyModel;
  origin: DocumentOrigin;
  loadExample(id: string): void;
}

const first = examples[0]!;

/** El documento que se está editando. Única fuente de verdad del modelo en la UI. */
export const useDocument = create<DocumentState>()((set) => ({
  model: first.model,
  origin: { kind: 'example', id: first.id },
  loadExample: (id) => {
    const example = examples.find((e) => e.id === id);
    if (example) set({ model: example.model, origin: { kind: 'example', id } });
  },
}));
