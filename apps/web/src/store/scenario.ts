import { useMemo } from 'react';
import { create } from 'zustand';
import { scenarioView, type Scenario, type ScenarioView } from '../scenario/view.ts';
import { useDocument } from './document.ts';

interface ScenarioState {
  active: Scenario | null;
  set(scenario: Scenario | null): void;
}

/** El escenario que se está simulando sobre el mapa. No entra en el historial del documento. */
export const useScenario = create<ScenarioState>()((set) => ({
  active: null,
  set: (active) => set({ active }),
}));

/** Vista del escenario activo sobre el modelo actual (se recalcula al editar). */
export function useScenarioView(): ScenarioView | null {
  const model = useDocument((s) => s.model);
  const active = useScenario((s) => s.active);
  return useMemo(() => (active ? scenarioView(model, active) : null), [model, active]);
}

export const sameScenario = (a: Scenario | null, b: Scenario | null) => a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b);
