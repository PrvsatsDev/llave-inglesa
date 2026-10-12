# Ideas pendientes

Ideas anotadas para no olvidarlas. **Ninguna es definitiva**: cada una necesita
pensarse antes de implementarla.

## Interfaz y distribución

- **Tienda oficial de Umbrel** (2026-10-09): ya funciona en la tienda comunitaria
  (`PrvsatsDev/psats-umbrel-app-store`). Para la oficial (`getumbrel/umbrel-apps`), un PR con la carpeta de la app,
  capturas y logo en la descripción. La interfaz ya está también en inglés; `requiresHttps` lo admiten para apps que
  necesitan un contexto seguro (como Actual o Vaultwarden), y abierta por http:// ya avisa en vez de fallar.

## Roadmap (acordado el 2026-10-12)

En este orden; cada punto se diseña y se discute antes de implementarlo.

1. ~~**Dónde vive cada persona**~~: hecho (2026-10-12).
2. ~~**Calidad de la entropía**~~: hecho (2026-10-12), con un solo corte en 128 bits.
3. ~~**Multisig sin descriptor como error grave**~~: hecho (2026-10-12), sin cambiar las restas.
4. **Ordenador de firma**, solo dos extremos: ordenador de uso diario (muy mala idea, muy
   penalizado) y ordenador dedicado, sin red e instalado a conciencia (penaliza algo, mucho
   menos). Falta decidir en qué consiste la penalización (malware que cambia direcciones de
   recepción o cambio, firma a ciegas, explotar los fallos de dispositivo que hoy solo se avisan).
5. **Timelocks y editor Miniscript** (la "idea 2"): la política ya es un árbol, preparado para
   nodos `after`/`older`.

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
