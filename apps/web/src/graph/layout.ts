import type { Id } from '@llave-inglesa/domain';

export const LOCATION_WIDTH = 300;
export const PERSON_WIDTH = 220;
const LOCATION_GAP = 72;
const PERSON_GAP = 56;
const ROW_GAP = 140;

/** Altura aproximada de una ubicación (cabecera + filas de objetos). */
export const locationHeight = (rows: number) => 60 + Math.max(rows, 1) * 52 + 12;

interface LocationInput {
  id: Id;
  rows: number;
}

interface PersonInput {
  id: Id;
  rows: number;
  /** Ubicaciones a las que accede (para ordenar y reducir cruces). */
  links: Id[];
}

/**
 * Layout determinista en dos filas: ubicaciones arriba, personas abajo.
 * Las personas se ordenan por el baricentro de sus ubicaciones y ambas filas se centran.
 */
export function layoutGraph(locations: LocationInput[], people: PersonInput[]): Map<Id, { x: number; y: number }> {
  const positions = new Map<Id, { x: number; y: number }>();

  const locationsWidth = locations.length * LOCATION_WIDTH + Math.max(locations.length - 1, 0) * LOCATION_GAP;
  const column = new Map<Id, number>();
  locations.forEach((l, i) => {
    column.set(l.id, i);
    positions.set(l.id, { x: i * (LOCATION_WIDTH + LOCATION_GAP), y: 0 });
  });

  const barycenter = (p: PersonInput) => {
    const cols = p.links.map((id) => column.get(id)).filter((c): c is number => c !== undefined);
    return cols.length ? cols.reduce((a, b) => a + b, 0) / cols.length : Number.POSITIVE_INFINITY;
  };
  const ordered = people
    .map((p, i) => ({ p, i, b: barycenter(p) }))
    .sort((a, b) => a.b - b.b || a.i - b.i)
    .map(({ p }) => p);

  const peopleWidth = ordered.length * PERSON_WIDTH + Math.max(ordered.length - 1, 0) * PERSON_GAP;
  const offset = (locationsWidth - peopleWidth) / 2;
  const peopleY = Math.max(0, ...locations.map((l) => locationHeight(l.rows))) + ROW_GAP;
  ordered.forEach((p, i) => positions.set(p.id, { x: offset + i * (PERSON_WIDTH + PERSON_GAP), y: peopleY }));

  return positions;
}
