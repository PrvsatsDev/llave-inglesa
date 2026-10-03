#!/usr/bin/env python3
"""
Genera los ficheros del logo a partir de una sola definición: la B de Bitcoin (inclinada 14°, como
el logo de Bitcoin) cuya parte derecha central es la cabeza de una llave inglesa.

  apps/web/public/logo.svg        llave clara: la app es oscura
  apps/web/public/favicon.svg     la llave cambia de color según el tema del navegador
  docs/img/logo-claro.svg         para fondos claros (README en GitHub, documentos)
  docs/img/logo-oscuro.svg        para fondos oscuros

Uso: python3 scripts/logo.py
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ORANGE = "#F7931A"
NAVY = "#1E3A5F"
LIGHT_BLUE = "#8FB8F0"
TILT = 14

HANDLE = '<rect x="36" y="44" width="38" height="12" rx="6"/>'
HEAD = '<circle cx="71" cy="50" r="19"/>'


def svg(wrench_fill: str, style: str = "") -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{style}
  <defs>
    <!-- Hueco entre la B y la llave, para que no se fundan a tamaño pequeño. -->
    <mask id="hueco">
      <rect width="100" height="100" fill="#fff"/>
      <g fill="#000" stroke="#000" stroke-width="8" stroke-linejoin="round">{HANDLE}{HEAD}</g>
    </mask>
    <!-- Boca de la llave, abierta en V. -->
    <mask id="boca">
      <rect width="100" height="100" fill="#fff"/>
      <path d="M100 37L78 44.5A5.5 5.5 0 0 0 78 55.5L100 63Z" fill="#000"/>
    </mask>
  </defs>
  <g transform="rotate({TILT} 50 50)">
    <g fill="{ORANGE}" mask="url(#hueco)">
      <rect x="23" y="6" width="6" height="14"/><rect x="37" y="6" width="6" height="14"/>
      <rect x="23" y="80" width="6" height="14"/><rect x="37" y="80" width="6" height="14"/>
      <path fill-rule="evenodd" d="M17 18H52C64 18 70 25 70 34C70 43 64 50 52 50H17Z M32 28H50C54 28 56 30.5 56 34C56 37.5 54 40 50 40H32Z"/>
      <path fill-rule="evenodd" d="M17 50H57C70 50 77 57 77 66C77 75 70 82 57 82H17Z M32 60H54C59 60 62 62.5 62 66C62 69.5 59 72 54 72H32Z"/>
      <rect x="17" y="18" width="15" height="64"/>
    </g>
    <g class="llave" fill="{wrench_fill}" mask="url(#boca)">{HANDLE}{HEAD}</g>
  </g>
</svg>
"""


# En el favicon, la llave sigue el tema del navegador (pestañas claras u oscuras).
FAVICON_STYLE = f"""
  <style>.llave{{fill:{NAVY}}}@media (prefers-color-scheme: dark){{.llave{{fill:{LIGHT_BLUE}}}}}</style>"""

FILES = {
    "apps/web/public/logo.svg": svg(LIGHT_BLUE),
    "apps/web/public/favicon.svg": svg(NAVY, FAVICON_STYLE),
    "docs/img/logo-claro.svg": svg(NAVY),
    "docs/img/logo-oscuro.svg": svg(LIGHT_BLUE),
}

for path, content in FILES.items():
    (ROOT / path).write_text(content)
    print(path)
