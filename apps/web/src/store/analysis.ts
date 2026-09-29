import { parseModel } from '@llave-inglesa/domain';
import type { Analysis } from '@llave-inglesa/engine';
import { useEffect } from 'react';
import { create } from 'zustand';
import { requestAnalysis } from '../analysis/client.ts';
import { useDocument } from './document.ts';

export type AnalysisStatus = 'running' | 'ready' | 'invalid' | 'error';

interface AnalysisState {
  status: AnalysisStatus;
  /** Último análisis válido (se mantiene visible, atenuado, mientras se recalcula o hay errores). */
  analysis: Analysis | null;
  /** Análisis anterior del mismo documento, para mostrar cuánto ha cambiado cada puntuación. */
  previous: Analysis | null;
  ms: number | null;
  error: string | null;
}

export const useAnalysis = create<AnalysisState>()(() => ({
  status: 'running',
  analysis: null,
  previous: null,
  ms: null,
  error: null,
}));

const DEBOUNCE_MS = 120;

/** Recalcula el análisis en el worker cada vez que cambia el modelo (si es válido). */
export function useLiveAnalysis() {
  const model = useDocument((s) => s.model);
  const originId = useDocument((s) => s.origin.id);

  // Al cambiar de documento no tiene sentido comparar con el anterior.
  useEffect(() => {
    useAnalysis.setState({ analysis: null, previous: null });
  }, [originId]);

  useEffect(() => {
    if (!parseModel(model).ok) {
      useAnalysis.setState({ status: 'invalid' });
      return;
    }
    useAnalysis.setState({ status: 'running' });
    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await requestAnalysis(model);
      if (cancelled || !response) return;
      if (response.ok) {
        useAnalysis.setState((s) => ({
          status: 'ready',
          previous: s.analysis,
          analysis: response.analysis,
          ms: response.ms,
          error: null,
        }));
      } else {
        useAnalysis.setState({ status: 'error', error: response.error });
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [model]);
}
