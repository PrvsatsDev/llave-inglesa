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

### Ahora: cambios pequeños antes de la próxima versión (sin tocar el motor)

1. **«+ Fuente» enfoca las tiradas**: hoy añade «Dados» sin número y el aviso salta al momento; llevar el cursor a
   la casilla de tiradas.
2. **La guía menciona «Vive en»** en *Montar tu esquema* (si no se indica, se supone lo peor).
3. **R10: el custodio sin «Vive en»**: explicarlo en la descripción del ejemplo (no vive en su despacho).
4. **Por qué sube la seguridad sin descriptor**: un texto en el desglose de Seguridad (sin descriptor, el ladrón
   tampoco puede construir la transacción). Solo texto: el motor ya lo calcula.
5. **Ejemplos sin Coldcard**, salvo el de su propio fallo (R07): no se quiere darles más publicidad (ni a Ledger).
   Si alguno usa el PIN de coacción, sustituirla por otro modelo que lo tenga; si no lo hay, ese se queda.
   Candidatos: Trezor, BitBox, Passport, Keystone.
6. **Más acciones en el mapa**: borrar con la tecla Supr el elemento seleccionado y, si no es complicado, mover
   dispositivos y backups entre ubicaciones arrastrándolos.

### Después

7. **Ordenador de firma**, solo dos extremos: ordenador de uso diario (muy mala idea, muy penalizado) y ordenador
   dedicado, sin red e instalado a conciencia (penaliza algo, mucho menos). Falta decidir en qué consiste la
   penalización (malware que cambia direcciones de recepción o cambio, firma a ciegas, explotar los fallos de
   dispositivo que hoy solo se avisan).
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
