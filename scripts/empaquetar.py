#!/usr/bin/env python3
"""
Empaqueta el build de la web (apps/web/dist) para una Release, de forma reproducible:
el mismo código da exactamente el mismo zip (orden, fechas y permisos fijos).

Genera en release/:
  llave-inglesa-vX.Y.Z.zip   la web lista para usar sin conexión, con un LEEME.txt
  SHA256SUMS                 hash de cada fichero de la web y del zip

Uso: npm run build && python3 scripts/empaquetar.py
La fecha de los ficheros es la del último commit (o SOURCE_DATE_EPOCH, si está definida).
"""

import hashlib
import json
import os
import subprocess
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "apps" / "web" / "dist"
OUT = ROOT / "release"

LEEME = """llave-inglesa v{version}
========================

Simulador de esquemas de custodia Bitcoin. Todo ocurre en tu navegador: sin red, sin cuentas.
Nunca escribas frases semilla, claves privadas ni passphrases reales: no hacen falta.

Cómo usarla sin conexión
------------------------
Los navegadores no cargan esta aplicación con doble clic en index.html (no permiten sus módulos
desde file://). Hay que servir la carpeta en tu propio equipo, por ejemplo con Python:

    cd llave-inglesa-v{version}
    python3 -m http.server 8000 --bind 127.0.0.1

y abrir http://127.0.0.1:8000 en el navegador. Nada sale de tu equipo.

Comprobar que es la versión publicada
-------------------------------------
Compara el hash de este zip con el fichero SHA256SUMS de la Release en GitHub, o recompílala
desde el código: ver docs/VERIFICAR.md en el repositorio.
"""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_epoch() -> int:
    if "SOURCE_DATE_EPOCH" in os.environ:
        return int(os.environ["SOURCE_DATE_EPOCH"])
    out = subprocess.run(["git", "log", "-1", "--format=%ct"], cwd=ROOT, capture_output=True, text=True, check=True)
    return int(out.stdout.strip())


def main() -> int:
    if not (DIST / "index.html").is_file():
        print("Falta el build: ejecuta antes `npm run build`.", file=sys.stderr)
        return 1
    version = json.loads((ROOT / "apps" / "web" / "package.json").read_text())["version"]
    name = f"llave-inglesa-v{version}"
    # Fecha fija en UTC (el formato zip no admite fechas anteriores a 1980).
    stamp = time.gmtime(max(source_epoch(), 315532800))[:6]

    files = sorted(p for p in DIST.rglob("*") if p.is_file())
    entries = [(f"{name}/{p.relative_to(DIST).as_posix()}", p.read_bytes()) for p in files]
    entries.append((f"{name}/LEEME.txt", LEEME.format(version=version).encode()))
    entries.sort()

    OUT.mkdir(exist_ok=True)
    zip_path = OUT / f"{name}.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for arcname, data in entries:
            info = zipfile.ZipInfo(arcname, date_time=stamp)
            info.external_attr = 0o644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3  # Unix, siempre, para que no dependa de dónde se empaqueta
            z.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    sums = [f"{sha256(data)}  {arcname}" for arcname, data in entries]
    sums.append(f"{sha256(zip_path.read_bytes())}  {zip_path.name}")
    (OUT / "SHA256SUMS").write_text("\n".join(sums) + "\n")
    print(f"{zip_path.relative_to(ROOT)}  {sha256(zip_path.read_bytes())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
