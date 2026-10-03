# Verificar llave-inglesa

llave-inglesa maneja un mapa de dónde está tu dinero, así que no deberías tener que fiarte: todo lo
publicado se puede comprobar contra el código.

- El **build es reproducible**: el mismo código da exactamente los mismos ficheros.
- Cada **Release** de GitHub trae el zip y un `SHA256SUMS` con el hash de cada fichero.
- La **web publicada** (https://llave-inglesa.vualt.net) sirve esos mismos ficheros, sin nada inyectado.

## 1. Comprobar un zip descargado

```sh
sha256sum llave-inglesa-v0.1.0.zip
```

Debe coincidir con el hash de las notas de la Release y con la última línea de su `SHA256SUMS`.

## 2. Recompilar desde el código

Necesitas git, Node 22 y Python 3.

```sh
git clone https://github.com/PrvsatsDev/llave-inglesa.git
cd llave-inglesa
git checkout v0.1.0
npm ci
npm run empaquetar
```

Se genera `release/SHA256SUMS`. Compáralo con el de la Release:

```sh
diff release/SHA256SUMS SHA256SUMS-de-la-release
```

Lo que importa son las líneas de los ficheros de la web: si coinciden, el código que has leído es el que
corre. La del zip también debería coincidir; si solo cambia esa, la diferencia está en cómo comprime tu
sistema, no en la aplicación.

## 3. Comprobar la web publicada

```sh
sh scripts/verificar-web.sh SHA256SUMS-de-la-release
```

Descarga cada fichero de https://llave-inglesa.vualt.net y compara su hash. La web puede ir por delante
de la última Release si se ha publicado algo después; para comprobar el estado actual, recompila desde
`main` y usa tu propio `release/SHA256SUMS`.

## 4. Comprobar que no hace peticiones de red

La política de seguridad del contenido (`connect-src 'none'`) impide cualquier petición, y va tanto en
el HTML como en las cabeceras de la web:

```sh
curl -sI https://llave-inglesa.vualt.net | grep -i content-security-policy
```

También puedes abrir las herramientas de desarrollador del navegador, pestaña *Red*, y ver que, tras
cargar la página, no sale nada más.
