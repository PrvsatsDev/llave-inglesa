import type { CustodyModel } from '@llave-inglesa/domain';

/**
 * Un ejemplo con sus textos en otro idioma (`EJEMPLOS`: texto en español → traducción). Solo cambian nombres,
 * descripciones y etiquetas de backups: los ids y todo lo que analiza el motor quedan igual. Lo que no esté en el
 * diccionario se queda como está (nombres de producto, K1…).
 */
export function traducirEjemplo(model: CustodyModel, textos: Readonly<Record<string, string>>): CustodyModel {
  const t = (s: string) => textos[s] ?? s;
  return {
    ...model,
    name: t(model.name),
    ...(model.description !== undefined && { description: t(model.description) }),
    people: model.people.map((p) => ({ ...p, name: t(p.name) })),
    locations: model.locations.map((l) => ({ ...l, name: t(l.name) })),
    artifacts: model.artifacts.map((a) => ({ ...a, label: t(a.label) })),
  };
}
