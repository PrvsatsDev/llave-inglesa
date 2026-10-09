# Imagen para Umbrel: Caddy sirviendo, sin privilegios, los ficheros del zip de la Release (los de SHA256SUMS).
# No se construye a mano: scripts/imagen.sh prepara el contexto (este fichero, el Caddyfile y la carpeta web/).
FROM caddy:2.11.7-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f

ARG VERSION
LABEL org.opencontainers.image.title="llave-inglesa" \
      org.opencontainers.image.description="Simulador offline de esquemas de custodia Bitcoin" \
      org.opencontainers.image.source="https://github.com/PrvsatsDev/llave-inglesa" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}"

COPY Caddyfile /etc/caddy/Caddyfile
COPY web/ /srv/

# Caddy no guarda nada (persist_config off), pero necesita directorios con permiso de escritura: los de /tmp.
ENV XDG_CONFIG_HOME=/tmp/config XDG_DATA_HOME=/tmp/data
USER 1000:1000
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
