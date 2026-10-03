import { create } from 'zustand';
import type { Scenario } from '../scenario/view.ts';
import { sameScenario, useScenario } from './scenario.ts';
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
  /** La lista de vías de la que salió la simulación, para recorrerla con ‹ ›. */
  routes: Scenario[];
  /** La guía, abierta encima de la sección (null: cerrada). `chapter` null es el índice. */
  guide: { chapter: string | null } | null;
  /** Último capítulo leído: salir de la guía no lo olvida. */
  lastChapter: string | null;
  /** Abrir la guía en un capítulo, en el índice (null) o, sin argumento, donde se dejó. */
  openGuide(chapter?: string | null): void;
  /** Ir a una sección. Cierra la ficha abierta: la sección nunca cambia por su cuenta. */
  goSection(section: Section): void;
  /** Ir al análisis de una métrica (lo que hace pulsar su tarjeta). */
  goMetric(metric: MetricId): void;
  /** Simular un escenario y mostrarlo; `from` es la métrica de cuya lista viene, y `routes`, esa lista. */
  simulate(scenario: Scenario, from?: MetricId, routes?: Scenario[]): void;
}

export const useNavigation = create<NavigationState>()((set) => ({
  section: 'schema',
  metric: 'security',
  simulatedFrom: null,
  routes: [],
  guide: null,
  lastChapter: null,
  goSection: (section) => {
    useSelection.getState().select(null);
    set({ section, simulatedFrom: null, routes: [], guide: null });
  },
  goMetric: (metric) => {
    useSelection.getState().select(null);
    set({ section: 'analysis', metric, simulatedFrom: null, routes: [], guide: null });
  },
  simulate: (scenario, from, routes) => {
    useSelection.getState().select(null);
    useScenario.getState().set(scenario);
    set({ section: 'simulate', simulatedFrom: from ?? null, routes: from ? (routes ?? []) : [], guide: null });
  },
  openGuide: (chapter) => {
    useSelection.getState().select(null);
    set((s) => {
      const target = chapter === undefined ? s.lastChapter : chapter;
      return { guide: { chapter: target }, lastChapter: target ?? s.lastChapter };
    });
  },
}));

/**
 * "Volver" (botón ← o Esc), de lo más profundo a lo más general: la ficha anterior; en la guía,
 * del capítulo al índice y del índice a la sección en la que se estaba; después, la lista del análisis de la que salió la simulación (que sigue en el mapa);
 * y, si no hay a dónde volver, salir de la simulación. Devuelve false si no había nada que hacer.
 */
export function goBack(): boolean {
  const selection = useSelection.getState();
  if (selection.selected) {
    selection.back();
    return true;
  }
  const nav = useNavigation.getState();
  if (nav.guide) {
    // Volver al índice es dejarla en el índice: la próxima vez se abre ahí.
    useNavigation.setState(nav.guide.chapter ? { guide: { chapter: null }, lastChapter: null } : { guide: null });
    return true;
  }
  if (nav.section === 'simulate' && nav.simulatedFrom) {
    useNavigation.setState({ section: 'analysis', metric: nav.simulatedFrom, simulatedFrom: null, routes: [] });
    return true;
  }
  const scenario = useScenario.getState();
  if (scenario.active) {
    scenario.set(null);
    return true;
  }
  return false;
}

/** Posición del escenario activo en la lista de vías de la que salió (-1 si se ha modificado). */
export function routePosition(routes: readonly Scenario[], active: Scenario | null): number {
  return active ? routes.findIndex((r) => sameScenario(r, active)) : -1;
}
