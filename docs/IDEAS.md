# Ideas pendientes

Ideas anotadas para no olvidarlas. **Ninguna es definitiva**: cada una necesita
pensarse antes de implementarla.

## Interfaz y distribución

- **Tienda oficial de Umbrel** (2026-10-09): ya funciona en la tienda comunitaria
  (`PrvsatsDev/psats-umbrel-app-store`). Para la oficial (`getumbrel/umbrel-apps`), un PR con la carpeta de la app,
  capturas y logo en la descripción. La interfaz ya está también en inglés; `requiresHttps` lo admiten para apps que
  necesitan un contexto seguro (como Actual o Vaultwarden), y abierta por http:// ya avisa en vez de fallar.

## Simplificaciones conscientes del motor (para iterar)

- **Calidad de la entropía**: pocas tiradas de dados o de moneda para 12/24 palabras. Hoy el número
  de tiradas solo cuenta para mitigar un fallo de RNG publicado; una semilla de solo 20 tiradas no
  se marca como débil.
- **Dónde vive cada persona** (de la calibración): la llave inglesa en una ubicación donde la
  víctima no vive exige llevarla allí o retener a quien vive allí; podría costar algo más
  (+0,5), como ya pasa en la caja del banco (+1). Requiere modelar quién vive dónde.
- **Timelocks y editor Miniscript** (la "idea 2"): la política ya es un árbol,
  preparado para nodos `after`/`older`.
