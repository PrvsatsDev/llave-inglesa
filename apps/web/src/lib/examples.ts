import { parseModel, type CustodyModel } from '@llave-inglesa/domain';

/** Esquemas de ejemplo: los mismos fixtures que usan los tests del motor. */
const files = import.meta.glob<unknown>('../../../../fixtures/*.json', { eager: true, import: 'default' });

const ORDER = ['todo-en-casa', 'distribuido-2de3', 'singlesig-passphrase'];

export interface Example {
  id: string;
  model: CustodyModel;
}

export const examples: readonly Example[] = Object.entries(files)
  .map(([path, json]) => {
    const id = path.split('/').pop()!.replace(/\.json$/, '');
    const result = parseModel(json);
    if (!result.ok) throw new Error(`El ejemplo "${id}" no es válido`);
    return { id, model: result.model };
  })
  .sort((a, b) => rank(a.id) - rank(b.id));

function rank(id: string) {
  const i = ORDER.indexOf(id);
  return i < 0 ? ORDER.length : i;
}
