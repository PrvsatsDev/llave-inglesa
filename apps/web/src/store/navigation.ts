import { create } from 'zustand';
import type { Scenario } from '../scenario/view.ts';
import { useScenario } from './scenario.ts';
import { useSelection } from './selection.ts';

/** Las tres secciones de la columna: diseñar, entender y probar. */
export type Section = 'schema' | 'analysis' | 'simulate';
export type MetricId = 'security' | 'resilience' | 'usability' | 'inheritance';

interface NavigationState {
  section: Section;
  /** Métrica que se ve en Análisis (la tarjeta marcada). */
  metric: MetricId;
  /** Si la simulación se abrió desde una lista del análisis, a qué métrica vuelve "volver". */
  simulatedFrom: MetricId | null;
  /** Ir a una sección. Cierra la ficha abierta: la sección nunca cambia por su cuenta. */
  goSection(section: Section): void;
  /** Ir al análisis de una métrica (lo que hace pulsar su tarjeta). */
  goMetric(metric: MetricId): void;
  /** Simular un escenario y mostrarlo; `from` es la métrica de cuya lista viene. */
  simulate(scenario: Scenario, from?: MetricId): void;
}

export const useNavigation = create<NavigationState>()((set) => ({
  section: 'schema',
  metric: 'security',
  simulatedFrom: null,
  goSection: (section) => {
    useSelection.getState().select(null);
    set({ section, simulatedFrom: null });
  },
  goMetric: (metric) => {
    useSelection.getState().select(null);
    set({ section: 'analysis', metric, simulatedFrom: null });
  },
  simulate: (scenario, from) => {
    useSelection.getState().select(null);
    useScenario.getState().set(scenario);
    set({ section: 'simulate', simulatedFrom: from ?? null });
  },
}));

/**
 * "Volver" (botón ← o Esc), de lo más profundo a lo más general: la ficha anterior;
 * después, la lista del análisis de la que salió la simulación (que sigue en el mapa);
 * y, si no hay a dónde volver, salir de la simulación. Devuelve false si no había nada que hacer.
 */
export function goBack(): boolean {
  const selection = useSelection.getState();
  if (selection.selected) {
    selection.back();
    return true;
  }
  const nav = useNavigation.getState();
  if (nav.section === 'simulate' && nav.simulatedFrom) {
    useNavigation.setState({ section: 'analysis', metric: nav.simulatedFrom, simulatedFrom: null });
    return true;
  }
  const scenario = useScenario.getState();
  if (scenario.active) {
    scenario.set(null);
    return true;
  }
  return false;
}
