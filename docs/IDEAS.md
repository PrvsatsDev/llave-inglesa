# Ideas pendientes

Ideas anotadas para no olvidarlas. **Ninguna es definitiva**: cada una necesita
pensarse antes de implementarla.

## Interfaz y distribución

- **Tienda oficial de Umbrel** (2026-10-09): ya funciona en la tienda comunitaria
  (`PrvsatsDev/psats-umbrel-app-store`). Para la oficial (`getumbrel/umbrel-apps`), un PR con la carpeta de la app,
  capturas y logo en la descripción. La interfaz ya está también en inglés; `requiresHttps` lo admiten para apps que
  necesitan un contexto seguro (como Actual o Vaultwarden), y abierta por http:// ya avisa en vez de fallar.

## Roadmap (reordenado el 2026-10-12)

Hechos el 2026-10-12: dónde vive cada persona, calidad de la entropía (un solo corte en 128 bits) y multisig sin
ningún backup del descriptor como problema grave.

### Cambios pequeños antes de la próxima versión: hechos (2026-10-12)

1. ~~«+ Fuente» enfoca las tiradas~~.
2. ~~La guía menciona «Vive en»~~.
3. ~~R10: el custodio sin «Vive en», explicado en la descripción~~.
4. ~~Por qué sube la seguridad sin descriptor~~, en el desglose de Seguridad.
5. ~~Ejemplos sin Coldcard~~ (salvo R07): Passport Prime, Keystone 3 Pro, BitBox02 y Trezor Safe 5; las notas no
   cambian. Vídeo regenerado.
6. ~~Más acciones en el mapa~~: Supr elimina lo seleccionado (con confirmación si es una ubicación con objetos) y,
   en escritorio, los dispositivos y backups se arrastran a otra ubicación.

### Después

7. ~~**Ordenador de firma**~~ (2026-10-12): ordenador o móvil, en una ubicación o encima de una persona, de uso
   general (−2 de seguridad, malware de esfuerzo 1) o dedicado (malware 3); su cartera da el descriptor y su malware
   explota los avisos `host-exploit` de los dispositivos que se le conectan por cable o Bluetooth.
8. **Procedencia del dispositivo**, cerca del firmware: (a) DIY, comprando las piezas y montado en casa, mejor que
   comprado montado (solo en los que de verdad tienen esa opción); (b) si se compró montado, si llegó con el precinto
   de seguridad (tamper-evident) intacto; (c) si no es DIY, dónde se compró: al fabricante (lo mejor), revendedor
   oficial (medio), tienda no oficial, reacondicionado o de segunda mano (lo peor). Por madurar: si afecta a la
   puntuación (sería lo ideal) o solo da avisos.
9. **Timelocks y editor Miniscript** (la "idea 2"): la política ya es un árbol, preparado para nodos `after`/`older`.

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
