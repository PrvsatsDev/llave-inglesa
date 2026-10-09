import { UI } from '../lib/text.ts';
import type { CustodyModel } from '@llave-inglesa/domain';
import type { AnalysisResponse } from './protocol.ts';

let worker: Worker | null = null;
let inFlight: { id: number; resolve(r: AnalysisResponse | null): void } | null = null;
let nextId = 1;

function spawn(): Worker {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'analisis' });
  w.onmessage = (e: MessageEvent<AnalysisResponse>) => {
    if (inFlight?.id !== e.data.id) return;
    const { resolve } = inFlight;
    inFlight = null;
    resolve(e.data);
  };
  w.onerror = (e) => {
    const pending = inFlight;
    inFlight = null;
    pending?.resolve({ id: pending.id, ok: false, error: e.message || UI.marco.falloAnalisis });
    w.terminate();
    if (worker === w) worker = null;
  };
  return w;
}

/**
 * Pide un análisis. Si había otro en curso se cancela (se termina el worker),
 * y su promesa se resuelve con null: solo cuenta el último modelo.
 */
export function requestAnalysis(model: CustodyModel): Promise<AnalysisResponse | null> {
  if (inFlight) {
    inFlight.resolve(null);
    inFlight = null;
    worker?.terminate();
    worker = null;
  }
  worker ??= spawn();
  const id = nextId++;
  return new Promise((resolve) => {
    inFlight = { id, resolve };
    worker!.postMessage({ id, model });
  });
}
