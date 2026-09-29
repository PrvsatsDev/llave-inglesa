import type { CustodyModel } from '@llave-inglesa/domain';
import type { Analysis } from '@llave-inglesa/engine';

/** Mensajes entre la UI y el worker de análisis. */
export interface AnalysisRequest {
  id: number;
  model: CustodyModel;
}

export type AnalysisResponse =
  | { id: number; ok: true; analysis: Analysis; ms: number }
  | { id: number; ok: false; error: string };
