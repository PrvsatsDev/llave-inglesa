import type { Id } from '@llave-inglesa/domain';

export const LOCATION_WIDTH = 300;
export const PERSON_WIDTH = 220;
const LOCATION_GAP = 72;
const PERSON_GAP = 56;
const ROW_GAP = 140;
/** En vertical: hueco entre la columna de ubicaciones y la de personas (caben las etiquetas «tras fallecer…»). */
const COLUMN_GAP = 130;
const STACK_GAP = 40;
const PERSON_STACK_GAP = 24;
/** Altura de la cabecera de una ubicación, donde llegan las líneas de acceso en vertical. */
const HEADER_MIDDLE = 28;

/** Altura aproximada de una ubicación (cabecera + filas de objetos). */
export const locationHeight = (rows: number) => 60 + Math.max(rows, 1) * 52 + 12;

/** Altura aproximada de una persona: cabecera y, si sabe algo de memoria, sus insignias (unas dos por fila). */
export const personHeight = (rows: number) => (rows > 0 ? 80 + Math.ceil(rows / 2) * 26 : 60);

/** Horizontal: ubicaciones en fila y personas debajo. Vertical (pantalla estrecha): dos columnas. */
export type Orientation = 'horizontal' | 'vertical';

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
export function layoutGraph(
  locations: LocationInput[],
  people: PersonInput[],
  orientation: Orientation = 'horizontal',
): Map<Id, { x: number; y: number }> {
  if (orientation === 'vertical') return layoutVertical(locations, people);
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

/**
 * Layout determinista en dos columnas para pantalla estrecha: ubicaciones apiladas a la izquierda (lo contenido justo debajo de
 * su continente, en el orden recibido) y personas a la derecha, cada una a la altura media de las ubicaciones a las que accede,
 * empujadas hacia abajo si no caben. Así el esquema es estrecho y se lee bajando, sin encogerlo.
 */
function layoutVertical(locations: LocationInput[], people: PersonInput[]): Map<Id, { x: number; y: number }> {
  const positions = new Map<Id, { x: number; y: number }>();

  let y = 0;
  for (const l of locations) {
    positions.set(l.id, { x: 0, y });
    y += locationHeight(l.rows) + STACK_GAP;
  }

  const personX = LOCATION_WIDTH + COLUMN_GAP;
  const wanted = (p: PersonInput) => {
    const ys = p.links.map((id) => positions.get(id)?.y).filter((v): v is number => v !== undefined);
    // El centro de la persona, a la altura de las cabeceras de sus ubicaciones.
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length + HEADER_MIDDLE - personHeight(p.rows) / 2 : Number.POSITIVE_INFINITY;
  };
  const ordered = people
    .map((p, i) => ({ p, i, w: wanted(p) }))
    .sort((a, b) => a.w - b.w || a.i - b.i);

  let free = 0;
  for (const { p, w } of ordered) {
    const top = Math.max(free, Number.isFinite(w) ? w : free);
    positions.set(p.id, { x: personX, y: top });
    free = top + personHeight(p.rows) + PERSON_STACK_GAP;
  }

  return positions;
}
