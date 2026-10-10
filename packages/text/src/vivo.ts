/**
 * Un objeto «vivo»: cada lectura se resuelve en el momento sobre lo que devuelva `resolver` (los textos del
 * idioma activo). Así `const T = UI.esquema` al cargar un módulo sigue sirviendo tras cambiar de idioma:
 * - un objeto o array devuelve otro objeto vivo (el mismo cada vez, para que las comparaciones aguanten);
 * - una función propia (un texto con datos) devuelve una que llama a la del idioma activo al ejecutarse;
 * - lo demás (cadenas, números, métodos de array…) se lee del idioma activo tal cual.
 * Una cadena guardada en una constante al cargar un módulo, en cambio, se queda en el idioma de entonces.
 */
export function vivo<T extends object>(resolver: () => T): T {
  const hijos = new Map<PropertyKey, unknown>();
  const actual = () => resolver() as Record<PropertyKey, unknown>;
  return new Proxy((Array.isArray(resolver()) ? [] : {}) as T, {
    get(_, prop) {
      const target = actual();
      const value = Reflect.get(target, prop, target);
      if (typeof value === 'function') {
        if (!Object.hasOwn(target, prop)) return (value as (...a: unknown[]) => unknown).bind(target);
        if (!hijos.has(prop)) hijos.set(prop, (...args: unknown[]) => (actual()[prop] as (...a: unknown[]) => unknown)(...args));
        return hijos.get(prop);
      }
      if (value !== null && typeof value === 'object') {
        if (!hijos.has(prop)) hijos.set(prop, vivo(() => actual()[prop] as object));
        return hijos.get(prop);
      }
      return value;
    },
    has: (_, prop) => prop in actual(),
    ownKeys: () => Reflect.ownKeys(actual()),
    getOwnPropertyDescriptor(_, prop) {
      const d = Reflect.getOwnPropertyDescriptor(actual(), prop);
      // 'length' de un array es no configurable en el objetivo: hay que respetarlo.
      return d && prop !== 'length' ? { ...d, configurable: true } : d;
    },
  });
}
