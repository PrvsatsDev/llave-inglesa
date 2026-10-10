import { parseModel, policyKeys, type CustodyModel } from '@llave-inglesa/domain';
import { EJEMPLOS, idioma, traducirEjemplo, type Idioma } from './text.ts';

/**
 * Esquemas de ejemplo: los mismos fixtures que usan los tests del motor. Los de `fixtures/referencia/`
 * son la galería de la calibración (docs/CALIBRACION.md), de peor a mejor dentro de cada grupo. Están en español;
 * `examples()` los da en el idioma activo (packages/text: `EJEMPLOS`).
 */
const files = import.meta.glob<unknown>(['../../../../fixtures/*.json', '../../../../fixtures/referencia/*.json'], { eager: true, import: 'default' });

const ORDER = ['todo-en-casa', 'distribuido-2de3', 'singlesig-passphrase'];

/** Sus nombres, en `UI.cabecera.gruposEjemplos`. */
export type ExampleGroup = 'inicio' | 'single' | 'multi';
export const EXAMPLE_GROUPS: readonly ExampleGroup[] = ['inicio', 'single', 'multi'];

export interface Example {
  id: string;
  group: ExampleGroup;
  model: CustodyModel;
}

const originales: readonly Example[] = Object.entries(files)
  .map(([path, json]) => {
    const id = path.split('/').pop()!.replace(/\.json$/, '');
    const result = parseModel(json);
    if (!result.ok) throw new Error(`El ejemplo "${id}" no es válido`); // texto-ok: error de desarrollo
    const gallery = path.includes('/referencia/');
    const group: ExampleGroup = !gallery ? 'inicio' : policyKeys(result.model.policy).length > 1 ? 'multi' : 'single';
    return { id, group, model: result.model };
  })
  .sort((a, b) => EXAMPLE_GROUPS.indexOf(a.group) - EXAMPLE_GROUPS.indexOf(b.group) || rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));

function rank(id: string) {
  const i = ORDER.indexOf(id);
  return i < 0 ? ORDER.length : i;
}

const traducidos = new Map<Idioma, readonly Example[]>();

/** Los ejemplos en el idioma activo (mismos ids y mismo análisis; cambian nombres y descripciones). */
export function examples(): readonly Example[] {
  const i = idioma();
  let lista = traducidos.get(i);
  if (!lista) {
    lista = originales.map((e) => ({ ...e, model: traducirEjemplo(e.model, EJEMPLOS) }));
    traducidos.set(i, lista);
  }
  return lista;
}
