# llave-inglesa en Umbrel

La app para Umbrel es una imagen Docker mínima: [Caddy](https://caddyserver.com) sirviendo, sin privilegios y sin
registro de visitas, los mismos ficheros que la web publicada, con las mismas cabeceras de seguridad (incluida la
política que impide cualquier petición de red).

- `Dockerfile`: Caddy (imagen oficial, fijada por su digest) con el build en `/srv`, como usuario 1000.
- `Caddyfile`: generado desde `apps/web/security-headers.ts` (un test comprueba que está al día). Sin HTTPS propio ni
  HSTS: delante está Umbrel.

## Construirla

```sh
npm run empaquetar        # el zip reproducible de la Release, en release/
scripts/imagen.sh         # imagen local llave-inglesa:X.Y.Z
docker run --rm --read-only --tmpfs /tmp -p 8080:8080 llave-inglesa:X.Y.Z
```

La imagen se construye a partir del zip de la Release (sin su `LEEME.txt`), así que sirve exactamente los ficheros de
su `SHA256SUMS`. Para comprobarlo con la imagen en marcha:

```sh
sh scripts/verificar-web.sh release/SHA256SUMS http://127.0.0.1:8080
```

## Publicarla

La publica el workflow `.github/workflows/imagen.yml` en GitHub Container Registry, para amd64 y arm64:

- con cada etiqueta `vX.Y.Z`: `ghcr.io/prvsatsdev/llave-inglesa:X.Y.Z`;
- a mano (Actions → *Imagen para Umbrel* → *Run workflow*): `X.Y.Z-prueba-<commit>`, para probar antes de una versión.

En Umbrel se instala fijada por su digest (`imagen:X.Y.Z@sha256:…`), que da `docker buildx imagetools inspect`.

## Cifrado y HTTPS

El cifrado del documento usa WebCrypto, que el navegador solo da en un contexto seguro (HTTPS o `localhost`). Por eso
la app pide HTTPS a Umbrel (`requiresHttps: true`, umbrelOS 2.0 o posterior), que la abre en
`https://<tu-umbrel>:<puerto>` con su propio certificado.

## La tienda comunitaria

La app se instala desde la tienda comunitaria [psats-umbrel-app-store](https://github.com/PrvsatsDev/psats-umbrel-app-store)
(id `psats`, app `psats-llave-inglesa`, puerto 4580). Su `docker-compose.yml` fija la imagen por su digest, así que
**con cada versión** hay que actualizarla: cuando el workflow publique `X.Y.Z`, poner en la tienda la nueva imagen
(`ghcr.io/prvsatsdev/llave-inglesa:X.Y.Z@sha256:…`, el digest de `docker buildx imagetools inspect`), y la versión y
las notas en su `umbrel-app.yml`.

Probado en umbrelOS 2.0: se abre en `https://umbrel.local:4580` con el certificado de Umbrel, que el navegador no
conoce (avisa de que no es seguro; la conexión sí va cifrada). Aceptado el aviso, es un contexto seguro: el guardado
cifrado funciona y se vuelve a abrir tras cerrar el navegador.
