# Ideas pendientes

Ideas anotadas para no olvidarlas. **Ninguna es definitiva**: cada una necesita
pensarse antes de implementarla. Lo que ya está hecho se describe en [CAPACIDADES.md](CAPACIDADES.md).

## Próximas

- **Timelocks absolutos (`after`) y esperas por tiempo**: completan los timelocks, que hoy solo son relativos
  (`older`) y por bloques. Además, permitirían importar los descriptores que los usan, que ahora se rechazan.

## Distribución

- **Tienda oficial de Umbrel**: PR [getumbrel/umbrel-apps#6184](https://github.com/getumbrel/umbrel-apps/pull/6184)
  abierto el 2026-10-11, a la espera de revisión. Mientras tanto, la app se instala desde la tienda comunitaria
  (`PrvsatsDev/psats-umbrel-app-store`). Tras la fusión: insignias en el README.

## Aparcado

- **Taproot con árbol de scripts** (fase 8 de [PLAN-KEYS-REPARTIDAS.md](PLAN-KEYS-REPARTIDAS.md)): escribir y leer
  `tr(key interna, {hojas})` con Miniscript en tapscript, como Liana y Nunchuk. Las keys repartidas y `tr(KEY)` ya
  están hechas (fases 0 a 7). El trabajo iría casi entero a `packages/bitcoin` (reglas de tapscript: `multi_a`, claves
  x-only, otros límites; las hojas y la raíz de Merkle de BIP-341; la key interna o un punto NUMS; importar el árbol y
  comprobar que dice lo mismo que la política), con los vectores de BIP-341: más que `tr(KEY)` y parecido al
  Miniscript en `wsh`. El motor no cambia (la política es la misma) y la interfaz, poco: elegir SegWit o Taproot en una
  política con esperas, la key interna y los avisos de dispositivos. Aporta poco hoy: casi todo el que usa esperas lo
  hace en `wsh`, que ya está cubierto; firman Miniscript en tapscript pocos dispositivos (Ledger, Coldcard con Edge,
  Krux, Specter) y Frostsnap no firma hojas de tapscript. Lo justificaría que alguien pida importar un descriptor
  Taproot con árbol (hoy se rechaza como no admitido).
- **QR del descriptor en UR o BBQr**: en papel no cabe un QR animado, pero sí un UR en un solo QR
  estático o varias partes impresas. Solo si alguien lo pide o se encuentra una cartera que lo exija
  (Sparrow, Nunchuk, Specter o Coldcard leen el texto plano); hay dos formatos UR (`crypto-output` y
  `output-descriptor`) con compatibilidad desigual.
- **PIN de coacción frente a un ser querido**: si amenazan a tu pareja delante de ti, el PIN de coacción pierde
  fuerza. Hoy vale lo mismo.
- **«Analizando…» colgado** al volver a elegir por script el mismo ejemplo: no se puede provocar
  desde la interfaz.

Descartado: explicar en la carta para los herederos alternativas si falta una pieza (ya lista las
piezas de reserva; si no hay suficientes, no hay nada que hacer).
