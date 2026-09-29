import { analyze } from '@llave-inglesa/engine';
import type { AnalysisRequest, AnalysisResponse } from './protocol.ts';

/** El motor corre aquí, fuera del hilo de la UI: el análisis exhaustivo nunca bloquea la edición. */
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage(message: AnalysisResponse): void;
};

scope.onmessage = ({ data: { id, model } }) => {
  const start = performance.now();
  try {
    const analysis = analyze(model);
    scope.postMessage({ id, ok: true, analysis, ms: performance.now() - start });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
