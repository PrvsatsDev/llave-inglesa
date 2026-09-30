# 🔧 llave-inglesa

Simulador **offline** de esquemas de custodia Bitcoin (multisig, single-sig + passphrase):
modelas qué keys, dispositivos y backups tienes, dónde están y quién sabe qué, y la
herramienta calcula qué combinaciones de ataques permiten robarte y qué combinaciones
de desgracias te dejan sin fondos, explicando siempre el porqué.

> Nunca introduzcas semillas, claves privadas ni passphrases reales. El modelo solo
> describe *qué* existe y *dónde*. Aun así, ese mapa es sensible: trátalo como tal.

## Uso

```sh
npm install
npm run analyze -- fixtures/todo-en-casa.json
npm run check        # typecheck + tests
```

## Arquitectura

```
packages/domain   Esquema del documento (zod = tipos + validación), integridad, índice
packages/engine   Motor puro y determinista:
                    derive   inferencia hasta punto fijo, cada hecho con su justificación
                    attacks  átomos de ataque (intrusión, coacción, traición, RNG comprometido)
                    losses   átomos de pérdida (destrucción, fallecimiento, incapacidad, olvido…)
                    cuts     conjuntos mínimos de corte (análisis de árbol de fallos)
                    analyze  seguridad, resiliencia, usabilidad y herencia
apps/cli          Presentación en terminal (todo el texto en español vive aquí)
fixtures/         Esquemas de ejemplo, usados también como tests
```

El motor no produce texto: devuelve estructuras (reglas, ids, átomos) y cada interfaz
decide cómo contarlas. La política de gasto es un árbol tipo Miniscript desde el primer
día, para poder añadir timelocks sin rehacer nada.

## Licencia

[MIT](LICENSE).
