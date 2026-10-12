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

1. **Dónde vive cada persona**: coaccionar a alguien lejos de donde vive exige llevarlo allí (+0,5,
   como ya pasa en la caja del banco); y coaccionar a dos personas en la misma ubicación es un
   único asalto, no dos llaves inglesas (hoy 3,5 + 3,5).
2. **Calidad de la entropía**: pocas tiradas de dados o de moneda para 12/24 palabras. Hoy el número
   de tiradas solo cuenta para mitigar un fallo de RNG publicado; una semilla de solo 20 tiradas no
   se marca como débil.
3. **Multisig sin descriptor como error grave**: aviso de error bien visible y quizá más resta (hoy
   −35 herencia, −15 resiliencia). Sin distinguir derivaciones habituales de raras: no tenerlo es
   un error, sin matices.
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
- **«Analizando…» colgado** al volver a elegir por script el mismo ejemplo: no se puede provocar
  desde la interfaz.

Descartado: explicar en la carta para los herederos alternativas si falta una pieza (ya lista las
piezas de reserva; si no hay suficientes, no hay nada que hacer).
