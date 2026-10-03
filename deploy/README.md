# Despliegue en un servidor propio (Caddy)

La web es estática: se construye y se prueba en tu equipo, y al servidor solo llegan los ficheros
finales. Caddy los sirve tal cual (con HTTPS automático), así que la web publicada es idéntica al
build y se puede verificar fichero a fichero (`docs/VERIFICAR.md`).

En el servidor, dentro de la carpeta `RAIZ`:

```
versiones/v0.1.0/          cada versión desplegada, completa
actual  → versiones/v0.1.0  lo que se sirve (se cambia de golpe al desplegar)
anterior → versiones/…      para volver atrás con --volver
```

## Configuración local

Copia `deploy/servidor.env.ejemplo` como `deploy/servidor.env` y pon tu dominio, la carpeta del
servidor y el alias SSH. Ese fichero no se sube al repo (está en `.gitignore`), igual que el bloque
de Caddy que se genera a partir de él.

## En el servidor (una sola vez, como root)

1. **DNS**: registro A (y AAAA si hay IPv6) de tu dominio a la IP del servidor.

2. **Usuario de despliegue**, sin contraseña y sin sudo, que solo puede escribir en `RAIZ`
   (aquí `despliegue` y `/srv/llave-inglesa`; usa los de tu `servidor.env`):

   ```sh
   adduser --disabled-password --gecos "" despliegue
   mkdir -p /srv/llave-inglesa/versiones
   chown -R despliegue:despliegue /srv/llave-inglesa
   chmod 755 /srv/llave-inglesa
   install -d -m 700 -o despliegue -g despliegue /home/despliegue/.ssh
   echo 'CLAVE_PÚBLICA' > /home/despliegue/.ssh/authorized_keys   # la .pub de la clave de despliegue
   chown despliegue:despliegue /home/despliegue/.ssh/authorized_keys
   chmod 600 /home/despliegue/.ssh/authorized_keys
   ```

   Si `/etc/ssh/sshd_config` tiene `AllowUsers` o `AllowGroups`, añade el usuario y recarga: `systemctl reload ssh`.

3. **Caddy**: genera el bloque de tu sitio con `npx tsx scripts/caddy.ts` (crea `deploy/sitio.caddy`
   con las cabeceras de seguridad de la app), cópialo al servidor como `/etc/caddy/sitio.caddy`,
   añade al final de `/etc/caddy/Caddyfile`

   ```
   import /etc/caddy/sitio.caddy
   ```

   y comprueba y recarga:

   ```sh
   caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   systemctl reload caddy
   ```

   Si cambian las cabeceras de seguridad (`apps/web/security-headers.ts`), vuelve a generarlo,
   copiarlo y recargar Caddy.

## En tu equipo (una sola vez)

Una clave solo para desplegar:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/llave-inglesa-despliegue -C llave-inglesa-despliegue
```

y su alias en `~/.ssh/config` (el nombre es el `SSH_HOST` de `servidor.env`):

```
Host llave-inglesa
  HostName tu-dominio.example.net
  User despliegue
  IdentityFile ~/.ssh/llave-inglesa-despliegue
  IdentitiesOnly yes
```

Prueba: `ssh llave-inglesa 'ls /srv/llave-inglesa'`.

## Desplegar

```sh
git tag v0.1.0                  # la versión de apps/web/package.json
scripts/desplegar.sh            # comprueba, prueba, construye, sube, cambia `actual` y verifica
scripts/desplegar.sh --prueba   # el commit actual sin etiqueta, para probar
scripts/desplegar.sh --volver   # vuelve a la versión anterior
```
