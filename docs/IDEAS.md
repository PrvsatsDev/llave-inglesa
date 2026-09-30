# Ideas pendientes

Ideas anotadas para no olvidarlas. **Ninguna es definitiva**: cada una necesita
pensarse antes de implementarla.

## Propuestas del usuario (2026-09-29)

- **Introducir las xpubs y generar el descriptor.** Opción de pegar las xpubs (y
  fingerprints/derivaciones) de cada key para construir el descriptor real.
- **PDFs a partir de esa información:**
  - PDF del descriptor (para imprimir y guardar como backup).
  - PDF de herencia (carta/manual para los herederos).

- **Resistencia del soporte de cada backup.** No es lo mismo papel que metal ante un
  incendio o una inundación. Idea a pensar: separar "destrucción de la ubicación" en
  tipos de desastre (incendio, inundación…) y que cada soporte sobreviva o no a cada
  uno (p. ej. el papel no sobrevive a ninguno; una placa de acero, a ambos). Enlaza
  con la *resiliencia ponderada* de abajo.
- **Fortaleza de la passphrase.** Hoy basta con que exista para que proteja, pero
  una passphrase "1234" no protege nada. Idea a pensar: indicar su fortaleza
  aproximada (sin escribirla nunca: p. ej. "palabra corta", "frase de varias
  palabras", "aleatoria larga") y que una débil se pueda adivinar por fuerza bruta
  cuando el atacante ya tiene la semilla. Importa sobre todo en los casos en que la
  passphrase es lo único que queda: semilla adivinable por un fallo publicado
  (Coldcard 2026) o extracción física (Trezor One/T).
- **Vídeo de presentación** con animaciones usando la propia aplicación. Idea
  ambiciosa, "lo mismo no lo hacemos".

## Interfaz y documentación (2026-09-30)

- **Repaso de UX del panel derecho.** Cuesta encontrar lo que se busca: resumen,
  inspector y simulación comparten panel y hay muchas secciones. Revisarlo entero
  cuando la fase 2 esté cerrada.
- **Guía de uso** que lo explique todo, partiendo de [CAPACIDADES.md](CAPACIDADES.md).
- **Explicar el PIN de coacción en la simulación.** Al simular una vía que "vence un
  PIN de coacción", el panel dice "robado" sin explicar que el atacante tuvo que
  sortear ese PIN (y que por eso la vía cuesta más).
- **Resaltar en el mapa los dispositivos comprometidos** en una simulación de firmware
  malicioso o de extracción física (hoy estos ataques no iluminan nada).

## Simplificaciones conscientes del motor (para iterar)

- **Calidad de la entropía**: pocas tiradas de dados o de moneda para 12/24 palabras.
- **Resiliencia ponderada**: hoy todas las desgracias pesan igual (un incendio
  cuenta lo mismo que olvidar una contraseña).
- **Timelocks y editor Miniscript** (la "idea 2"): la política ya es un árbol,
  preparado para nodos `after`/`older`.

## Otros proyectos

- **Mapa de UTXOs / coin control** con análisis de privacidad, como proyecto aparte
  que reutilice el código Bitcoin compartido.
