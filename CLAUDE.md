# llave-inglesa

Simulador **offline** de esquemas de custodia Bitcoin (multisig, single-sig + passphrase):
se modela qué keys, dispositivos y backups hay, dónde están y quién sabe qué, y el motor
calcula qué combinaciones de ataques permiten robar, qué desgracias hacen perder los
fondos, la usabilidad y la herencia, explicando siempre el porqué.

El proyecto y toda la interfaz están en **español**. Las conversaciones con el usuario, también.

## Comandos

```sh
npm run dev        # web en http://127.0.0.1:5173
npm run check      # typecheck (raíz + web) + todos los tests — ejecutar antes de cada commit
npm run e2e        # pruebas en Chromium contra el build de producción; capturas en apps/web/e2e/.capturas
npm run e2e:publicada -w @llave-inglesa/web   # las mismas pruebas contra https://llave-inglesa.vualt.net
npm run analyze -- fixtures/todo-en-casa.json   # CLI
npx tsx scripts/guia.ts   # recalcula las cifras de la guía (tras cambiar score.ts o un ejemplo)
npm run build
```

## Arquitectura (monorepo con npm workspaces, TypeScript estricto)

```
packages/domain   Esquema (zod = tipos + validación), integridad, índice, operaciones de edición puras
packages/engine   Motor puro y determinista: inferencia con justificaciones, ataques, pérdidas,
                  cortes mínimos, puntuaciones (parámetros en score.ts)
packages/text     Todos los textos en español (compartidos por web y CLI)
packages/vault    Cifrado de documentos (AES-256-GCM + PBKDF2) y lectura de ficheros
apps/web          React + React Flow + zustand; el motor corre en un Web Worker
apps/cli          Informe en terminal
fixtures/         Esquemas de ejemplo, usados por la web y por los tests
docs/IDEAS.md     Ideas pendientes: ninguna es definitiva, se discuten antes de implementarlas
docs/CAPACIDADES.md  Inventario de todo lo que la herramienta soporta (base de la futura guía)
```

## Principios (no romperlos)

- **Nunca material secreto real**: ni semillas, ni claves privadas, ni passphrases. Como mucho
  fingerprints/xpubs. El modelo en sí es sensible (un mapa del tesoro): se guarda cifrado.
- **Sin red**: CSP con `connect-src 'none'`, fuentes locales, sin telemetría ni CDNs.
- **El motor no produce texto**: devuelve estructuras; los textos van en `packages/text`.
- **La UI nunca modifica el modelo por su cuenta**: usa las operaciones de `domain/edit.ts`
  (puras, con cascada). Principio: **desactivar conserva, eliminar limpia** (quitar un PIN o
  una passphrase deja las referencias latentes; eliminar algo limpia en cascada).
- **La política es un árbol tipo Miniscript** (`key`, `thresh`) para poder añadir timelocks.
- **Explicable**: cada resultado lleva su traza ("por qué"). Las puntuaciones salen de
  métricas visibles; sus parámetros viven solo en `packages/engine/src/score.ts`.
- **Colores**: todo por tokens en `apps/web/src/styles/tokens.css`. Los colores de key están
  validados para daltonismo (K1–K3) y nunca aparecen sin su etiqueta "Kn". El estado nunca
  va solo en color (icono + texto).
- **Inventario al día**: todo cambio de comportamiento (modelo, motor, catálogo, interfaz)
  actualiza `docs/CAPACIDADES.md` en el mismo commit, incluidos sus límites conocidos.
- **Tests**: propiedades con fast-check (monotonía del motor, editar nunca rompe el modelo) y
  los fixtures como casos de referencia. Añadir tests con cada cambio de comportamiento.

## Forma de trabajar

- Una rama por fase o funcionalidad, PR en GitHub y el usuario hace la fusión.
- Commits pequeños por paso, con mensaje en español.
- Tras cada paso visual, el usuario lo revisa en el navegador antes del commit. Antes, Claude ejecuta
  `npm run e2e` y mira las capturas (puede leerlas) para llegar a esa revisión con menos fallos.
- En WSL, Vite a veces no detecta ediciones rápidas seguidas: si el navegador muestra algo
  antiguo, reiniciar `npm run dev`.
