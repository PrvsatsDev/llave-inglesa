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
8. ~~**Procedencia del dispositivo**~~ (2026-10-12): montado en casa (solo DIY), precinto y dónde se compró; lo dudoso
   es el ataque «Dispositivo manipulado» (segunda mano o precinto roto 1,5, tienda no oficial 2,5, revendedor oficial
   4), que regala las semillas que pasan por él. Sin indicar no resta.
9. **Timelocks y editor Miniscript** (la "idea 2"), acordado el 2026-10-13. Nodo `older` (relativo, en días/meses
   → bloques) dentro de `thresh`; `after` queda para más adelante. Dato nuevo: cada cuánto mueve el titular las monedas
   (renovación). El motor evalúa la política «ahora» (sin timelocks) y «vencido» (con ellos): en el robo, la rama con
   espera cuesta más salvo que se renueve menos a menudo que la espera; una pérdida que deja la recuperación en pie
   pasa a «se recupera tras N meses»; la herencia se evalúa vencida; renovar cuesta usabilidad. Fases, una rama cada
   una, todas en la misma versión:
   1. ~~Modelo y motor con `older`~~ (2026-10-13, en local): ataque «esperar» (0,5 / 3), retrasos (−2), renovación
      (−10 de usabilidad), herencia con espera y tres ejemplos (R13–R15: recuperación de la heredera, 2 de 3 que se
      relaja y que se amplía).
   2. ~~Plantillas en la interfaz~~ (2026-10-13, en local): sencilla, herencia simple, multisig decreciente y
      ampliable (los nombres de Liana y Nunchuk), con espera en días o meses, renovación y la espera en el mapa.
   3. ~~Descriptor `wsh(miniscript)` y qué dispositivos firman Miniscript~~ (2026-10-14, en local): tipos y script con
      los vectores de Bitcoin Core (sin Taproot), descriptor de las plantillas e importación por plantilla, catálogo
      con soporte de Miniscript (Coldcard solo con Edge) y −10 de usabilidad si un dispositivo no la firma. Queda: los
      límites de operaciones y pila de Core, y los descriptores de Liana con `<2;3>`.
   4. Pendiente para el 2026-10-15 (hacer todo lo que sea viable):
      - Editor libre del árbol de la política (`key`, `thresh`, `older`), para lo que no cabe en las plantillas.
      - ~~Límites de Bitcoin Core en `wsh(miniscript)`~~ (2026-10-15): 201 operaciones y 100 elementos en el
        witness, como `IsSane` de Core y con sus vectores.
      - Importar los descriptores de Liana que repiten una xpub con otra rama de derivación (`<0;1>` y `<2;3>`).

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
