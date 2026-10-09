import type { CustodyModel } from '@llave-inglesa/domain';
import { UI } from './text.ts';
import type { MetricId, Section } from '../store/navigation.ts';
import type { Selection, SelectionKind } from '../store/selection.ts';

export const SECTION_LABEL: Record<Section, string> = UI.navegacion.secciones;
export const METRIC_LABEL: Record<MetricId, string> = UI.navegacion.metricas;
/** Una frase que dice qué hay en cada sitio, para no perderse. */
export const SECTION_INTRO: Record<Exclude<Section, 'analysis'>, string> = UI.navegacion.introSeccion;
export const METRIC_INTRO: Record<MetricId, string> = UI.navegacion.introMetrica;
export const KIND_LABEL: Record<SelectionKind, string> = UI.navegacion.tipos;

/** Nombre visible de una entidad, o null si ya no existe (p. ej. tras eliminarla). */
export function entityName(model: CustodyModel, s: Selection): string | null {
  switch (s.kind) {
    case 'location':
      return model.locations.find((e) => e.id === s.id)?.name ?? null;
    case 'person':
      return model.people.find((e) => e.id === s.id)?.name ?? null;
    case 'device':
      return model.devices.find((e) => e.id === s.id)?.label ?? null;
    case 'artifact':
      return model.artifacts.find((e) => e.id === s.id)?.label ?? null;
    case 'key':
      return model.keys.find((e) => e.id === s.id)?.label ?? null;
  }
}
