#!/usr/bin/env bash
# Despliega la web en un servidor propio con Caddy. Ver deploy/README.md.
#
#   scripts/desplegar.sh            la versión etiquetada (vX.Y.Z) del commit actual
#   scripts/desplegar.sh --prueba   el commit actual sin etiqueta (carpeta prueba-<commit>)
#   scripts/desplegar.sh --volver   vuelve a la versión desplegada antes
#
# Todo se construye y se prueba aquí; al servidor solo llegan los ficheros finales, por SSH, a una
# carpeta nueva. Después se cambia el enlace `actual` de golpe (sin un instante a medias) y se
# comprueba que la web publicada es idéntica, fichero a fichero, al build.
#
# Los datos del servidor (DOMINIO, RAIZ, SSH_HOST) están en deploy/servidor.env, que no se sube al repo.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f deploy/servidor.env ] || { echo "Falta deploy/servidor.env: copia deploy/servidor.env.ejemplo y rellénalo." >&2; exit 1; }
# shellcheck disable=SC1091
. deploy/servidor.env
: "${DOMINIO:?falta DOMINIO en deploy/servidor.env}" "${RAIZ:?falta RAIZ en deploy/servidor.env}" "${SSH_HOST:?falta SSH_HOST en deploy/servidor.env}"
CONSERVAR="${CONSERVAR:-5}"
URL="https://$DOMINIO"

paso() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
falla() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

if [ "${1:-}" = "--volver" ]; then
  paso "Volviendo a la versión anterior"
  ssh "$SSH_HOST" "set -e; cd $RAIZ; [ -L anterior ] || { echo 'No hay versión anterior.' >&2; exit 1; }
    a=\$(readlink actual); b=\$(readlink anterior)
    ln -sfn \"\$b\" actual.nuevo && mv -T actual.nuevo actual && ln -sfn \"\$a\" anterior
    echo \"actual → \$b (anterior → \$a)\""
  exit 0
fi

paso "Comprobando el código"
[ -z "$(git status --porcelain)" ] || falla "Hay cambios sin guardar: haz commit o descártalos antes de desplegar."
VERSION="$(node -p "require('./apps/web/package.json').version")"
if [ "${1:-}" = "--prueba" ]; then
  NOMBRE="prueba-$(git rev-parse --short HEAD)"
else
  ETIQUETA="$(git describe --exact-match --tags HEAD 2>/dev/null)" || falla "Este commit no tiene etiqueta. Crea v$VERSION o usa --prueba."
  [ "$ETIQUETA" = "v$VERSION" ] || falla "La etiqueta ($ETIQUETA) no coincide con la versión de la app (v$VERSION)."
  NOMBRE="$ETIQUETA"
fi
echo "Se desplegará $NOMBRE ($(git rev-parse --short HEAD))"

paso "Instalando dependencias exactas"
npm ci --no-audit --no-fund

paso "Typecheck y tests"
npm run check

paso "Pruebas en navegador (build de producción)"
npm run e2e

paso "Build y empaquetado reproducible"
npm run empaquetar

paso "Subiendo a $SSH_HOST:$RAIZ/versiones/$NOMBRE"
tar -C apps/web/dist -cz . | ssh "$SSH_HOST" "set -e; cd $RAIZ; mkdir -p versiones
  rm -rf versiones/$NOMBRE.subiendo && mkdir versiones/$NOMBRE.subiendo
  tar -xz -C versiones/$NOMBRE.subiendo
  rm -rf versiones/$NOMBRE && mv versiones/$NOMBRE.subiendo versiones/$NOMBRE
  if [ -L actual ] && [ \"\$(readlink actual)\" != versiones/$NOMBRE ]; then ln -sfn \"\$(readlink actual)\" anterior; fi
  ln -sfn versiones/$NOMBRE actual.nuevo && mv -T actual.nuevo actual
  # Solo las $CONSERVAR más recientes, sin tocar la actual ni la anterior.
  cd versiones; ls -1t | tail -n +$((CONSERVAR + 1)) | while read -r v; do
    [ \"versiones/\$v\" = \"\$(readlink ../actual)\" ] || [ \"versiones/\$v\" = \"\$(readlink ../anterior 2>/dev/null)\" ] || rm -rf \"\$v\"
  done
  echo \"actual → \$(readlink ../actual)\""

paso "Comprobando la web publicada"
sh scripts/verificar-web.sh release/SHA256SUMS "$URL"
curl -fsSI "$URL" | grep -qi "content-security-policy: .*connect-src 'none'" || falla "La web no manda el CSP."
echo "Cabeceras de seguridad: OK"

paso "Desplegado $NOMBRE en $URL"
