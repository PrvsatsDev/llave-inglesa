# Ideas pendientes

Ideas anotadas para no olvidarlas. **Ninguna es definitiva**: cada una necesita
pensarse antes de implementarla. Lo que ya está hecho se describe en [CAPACIDADES.md](CAPACIDADES.md).

## Próximas

- **Timelocks absolutos (`after`) y esperas por tiempo**: completan los timelocks, que hoy solo son relativos
  (`older`) y por bloques. Además, permitirían importar los descriptores que los usan, que ahora se rechazan.
- **Keys repartidas (FROST y Shamir) y Taproot (`tr(...)`)**: una key cuyo secreto son n shares de las que bastan
  t. Con FROST (Frostsnap), las shares nunca se juntan y en la cadena es una sola key Taproot, sin descriptor que
  guardar. Con Shamir (SLIP-39, SSKR), se juntan al recuperar en un dispositivo que guarda la semilla entera. Taproot
  entra con ellas: primero `tr(KEY)` y después el árbol de scripts con Miniscript (Liana y Nunchuk ya lo ofrecen).
  Lo pidió un usuario («T-of-N signing devices and their backups in custom locations and with custom people, with no
  PINs or passphrases… no descriptor to backup either»). Plan en [PLAN-KEYS-REPARTIDAS.md](PLAN-KEYS-REPARTIDAS.md).
- **Mapa de UTXOs y coin control** (la «idea 3»): un proyecto aparte, sobre privacidad, que reutilizaría
  `packages/bitcoin`.

## Distribución

- **Tienda oficial de Umbrel**: PR [getumbrel/umbrel-apps#6184](https://github.com/getumbrel/umbrel-apps/pull/6184)
  abierto el 2026-10-11, a la espera de revisión. Mientras tanto, la app se instala desde la tienda comunitaria
  (`PrvsatsDev/psats-umbrel-app-store`). Tras la fusión: insignias en el README.

## Aparcado

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
