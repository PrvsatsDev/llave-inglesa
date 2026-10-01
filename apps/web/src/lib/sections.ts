import type { CustodyModel } from '@llave-inglesa/domain';
import type { MetricId, Section } from '../store/navigation.ts';
import type { Selection, SelectionKind } from '../store/selection.ts';

export const SECTION_LABEL: Record<Section, string> = {
  schema: 'Esquema',
  analysis: 'Análisis',
  simulate: 'Simular',
};

export const METRIC_LABEL: Record<MetricId, string> = {
  security: 'Seguridad',
  resilience: 'Resiliencia',
  usability: 'Usabilidad',
  inheritance: 'Herencia',
};

/** Una frase que dice qué hay en cada sitio, para no perderse. */
export const SECTION_INTRO: Record<Exclude<Section, 'analysis'>, string> = {
  schema: 'Qué keys hay, dónde está cada cosa y quién sabe qué. Pulsa cualquier elemento, aquí o en el mapa, para editarlo.',
  simulate: 'Combina ataques o desgracias y mira en el mapa qué pasaría.',
};

export const METRIC_INTRO: Record<MetricId, string> = {
  security: 'Combinaciones de ataques con las que alguien podría gastar tus fondos, de la más barata a la más cara.',
  resilience: 'Desgracias que harían perder los fondos para siempre, o que los dejarían bloqueados un tiempo.',
  usability: 'Qué hace falta para firmar en el día a día.',
  inheritance: 'Si tus herederos podrían recuperar los fondos.',
};

export const KIND_LABEL: Record<SelectionKind, string> = {
  location: 'Ubicación',
  person: 'Persona',
  device: 'Dispositivo',
  artifact: 'Backup',
  key: 'Key',
};

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
