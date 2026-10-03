#!/usr/bin/env sh
# Comprueba que la web publicada sirve exactamente los ficheros de un SHA256SUMS
# (el de una Release, o el que genera `npm run empaquetar` al recompilar desde el código).
#
# Uso: sh scripts/verificar-web.sh [SHA256SUMS] [URL]
set -eu
SUMS="${1:-release/SHA256SUMS}"
URL="${2:-https://llave-inglesa.netlify.app}"
fallos=0
# El zip, el LEEME (solo va en el zip) y _headers (Netlify lo usa como configuración, no lo sirve) no se comparan.
grep -v -e '\.zip$' -e '/LEEME\.txt$' -e '/_headers$' "$SUMS" | while read -r esperado ruta; do
  fichero="${ruta#*/}"
  obtenido="$(curl -fsS "$URL/$fichero" | sha256sum | cut -d' ' -f1)"
  if [ "$obtenido" = "$esperado" ]; then echo "✓ $fichero"; else echo "✗ $fichero (publicado: $obtenido)"; echo x >> .verificar-fallos; fi
done
if [ -f .verificar-fallos ]; then rm -f .verificar-fallos; echo "La web publicada NO coincide."; exit 1; fi
echo "La web publicada coincide con $SUMS."
