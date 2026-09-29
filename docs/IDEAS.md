# Ideas pendientes

Ideas anotadas para no olvidarlas. **Ninguna es definitiva**: cada una necesita
pensarse antes de implementarla.

## Propuestas del usuario (2026-09-29)

- **Catálogo de hardware wallets.** Listado de dispositivos conocidos (fabricante,
  modelo, stateful/stateless, si acepta semillas externas, si registra multisig…)
  para elegir en vez de escribirlo a mano. Incluir **firmwares con vulnerabilidades
  o compromisos conocidos**, para que cuenten en el análisis.
- **Licencia MIT** para el repositorio.
- **Entropía con monedas: semilla-moneda.** Al elegir "moneda" como fuente de
  entropía, nombrar y referenciar el proyecto *semilla-moneda* de Estudio Bitcoin.
  (Pendiente: confirmar enlace y cómo citarlo.)
- **Introducir las xpubs y generar el descriptor.** Opción de pegar las xpubs (y
  fingerprints/derivaciones) de cada key para construir el descriptor real.
- **PDFs a partir de esa información:**
  - PDF del descriptor (para imprimir y guardar como backup).
  - PDF de herencia (carta/manual para los herederos).

## Simplificaciones conscientes del motor (para iterar)

- **PIN de coacción** (duress PIN / brick-me PIN de Coldcard y similares).
- **Firmware comprometido**, distinto de "RNG comprometido": un dispositivo que
  filtra o manipula, no solo que genera mala entropía. Enlaza con el catálogo de
  hardware wallets.
- **Calidad de la entropía**: pocas tiradas de dados o de moneda para 12/24 palabras.
- **Resiliencia ponderada**: hoy todas las desgracias pesan igual (un incendio
  cuenta lo mismo que olvidar una contraseña).
- **Timelocks y editor Miniscript** (la "idea 2"): la política ya es un árbol,
  preparado para nodos `after`/`older`.

## Otros proyectos

- **Mapa de UTXOs / coin control** con análisis de privacidad, como proyecto aparte
  que reutilice el código Bitcoin compartido.
