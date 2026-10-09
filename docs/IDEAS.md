# Ideas pendientes

Ideas anotadas para no olvidarlas. **Ninguna es definitiva**: cada una necesita
pensarse antes de implementarla.

## Propuestas del usuario (2026-09-29)

- **Introducir las xpubs y generar el descriptor.** Opción de pegar las xpubs (y
  fingerprints/derivaciones) de cada key para construir el descriptor real.
- **PDFs a partir de esa información:**
  - PDF del descriptor (para imprimir y guardar como backup).
  - PDF de herencia (carta/manual para los herederos).

## Interfaz y distribución

- **App para Umbrel** (2026-10-03): Docker + `umbrel-app.yml`. Umbrel sirve por http en la red local,
  donde el navegador no da WebCrypto (`crypto.subtle`), así que el cifrado necesitaría una alternativa
  en JavaScript puro (p. ej. @noble/ciphers + @noble/hashes).

## Simplificaciones conscientes del motor (para iterar)

- **Calidad de la entropía**: pocas tiradas de dados o de moneda para 12/24 palabras. Hoy el número
  de tiradas solo cuenta para mitigar un fallo de RNG publicado; una semilla de solo 20 tiradas no
  se marca como débil.
- **Dónde vive cada persona** (de la calibración): la llave inglesa en una ubicación donde la
  víctima no vive exige llevarla allí o retener a quien vive allí; podría costar algo más
  (+0,5), como ya pasa en la caja del banco (+1). Requiere modelar quién vive dónde.
- **Timelocks y editor Miniscript** (la "idea 2"): la política ya es un árbol,
  preparado para nodos `after`/`older`.

## Otros proyectos

- **Mapa de UTXOs / coin control** con análisis de privacidad, como proyecto aparte
  que reutilice el código Bitcoin compartido.
