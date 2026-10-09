#!/usr/bin/env bash
# Construye la imagen Docker para Umbrel a partir del zip de la Release (release/llave-inglesa-vX.Y.Z.zip,
# de `npm run empaquetar`): la imagen sirve exactamente los ficheros de SHA256SUMS. Ver umbrel/README.md.
#
#   scripts/imagen.sh                     imagen local llave-inglesa:X.Y.Z, para la arquitectura de este equipo
#   scripts/imagen.sh --publicar <repo>   amd64 + arm64, y la sube a <repo> (p. ej. ghcr.io/prvsatsdev/llave-inglesa)
#                                         con la etiqueta X.Y.Z, o la de ETIQUETA si está definida (pruebas)
set -euo pipefail

cd "$(dirname "$0")/.."
falla() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

VERSION="$(node -p "require('./apps/web/package.json').version")"
ZIP="release/llave-inglesa-v${VERSION}.zip"
[ -f "$ZIP" ] || falla "Falta $ZIP: ejecuta antes npm run empaquetar."

# El Caddyfile sale de las mismas cabeceras que la web publicada (un test comprueba que está al día).
npx tsx -e "import('./apps/web/security-headers.ts').then((m) => process.stdout.write(m.caddyContainer()))" > umbrel/Caddyfile

CTX="$(mktemp -d)"
trap 'rm -rf "$CTX"' EXIT
cp umbrel/Dockerfile umbrel/Caddyfile "$CTX/"
python3 -m zipfile -e "$ZIP" "$CTX"
mv "$CTX/llave-inglesa-v${VERSION}" "$CTX/web"
rm "$CTX/web/LEEME.txt" # solo va en el zip, como en la web publicada

if [ "${1:-}" = "--publicar" ]; then
  REPO="${2:?falta el repositorio de la imagen, p. ej. ghcr.io/prvsatsdev/llave-inglesa}"
  TAG="${ETIQUETA:-$VERSION}"
  # Solo copia ficheros (sin RUN): la imagen arm64 se construye sin emulación.
  docker buildx build --platform linux/amd64,linux/arm64 --build-arg "VERSION=${VERSION}" \
    --tag "${REPO}:${TAG}" --push "$CTX"
  docker buildx imagetools inspect "${REPO}:${TAG}" | sed -n '1,3p'
else
  docker build --build-arg "VERSION=${VERSION}" --tag "llave-inglesa:${VERSION}" "$CTX"
  echo "Imagen local llave-inglesa:${VERSION}. Para probarla: docker run --rm --read-only -p 8080:8080 llave-inglesa:${VERSION}"
fi
