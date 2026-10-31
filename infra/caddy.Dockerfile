# Imagen de Caddy con la interfaz ya construida, para linux/amd64. Se construye desde la raíz:
#   docker build --platform linux/amd64 -f infra/caddy.Dockerfile -t aletheia-web .
# Solo entra a la construcción lo que permite infra/caddy.Dockerfile.dockerignore.

# --- Etapa 1: interfaz ------------------------------------------------------------------
FROM node:26.8.1-trixie-slim@sha256:c0753125a3789977aefe869cbebccf70e3cfd7ea84ca48547458f02e4f1d7146 AS interfaz

# pnpm 12.14.0, la misma versión de la CI, como binario oficial verificado con la suma SHA-256
# que publica GitHub para ese archivo. Así la imagen no necesita npm.
ADD --checksum=sha256:3910c3852136bed5bc1511b9137a45fd4357ed6b3970d9d08893641e9005867e \
    https://github.com/pnpm/pnpm/releases/download/v12.14.0/pnpm-linux-x64.tar.gz \
    /tmp/pnpm.tar.gz
RUN mkdir /opt/pnpm \
    && tar --extract --gzip --file /tmp/pnpm.tar.gz --directory /opt/pnpm \
    && rm /tmp/pnpm.tar.gz \
    && ln -s /opt/pnpm/pnpm /usr/local/bin/pnpm

ENV CI=true
WORKDIR /web
# Primero solo las dependencias: si el código cambia pero ellas no, Docker reutiliza esta capa.
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

# --- Etapa 2: Caddy ---------------------------------------------------------------------
FROM caddy:2.11.7-alpine@sha256:e70b164da81ef698b3ad19af799ea6086ce6d9e48ed4079eb9fe26f6fbf14ee5

LABEL org.opencontainers.image.source="https://github.com/juand4cevedo-coder/ALETHEIA" \
      org.opencontainers.image.title="aletheia-web" \
      org.opencontainers.image.description="Caddy de ALETHEIA con la interfaz web."

# Caddy no corre como root. Docker permite a los contenedores abrir los puertos 80 y 443 sin
# privilegios, y /data, donde quedan los certificados, le pertenece.
RUN addgroup -S -g 10002 caddy \
    && adduser -S -D -H -u 10002 -G caddy -s /sbin/nologin caddy \
    && chown -R 10002:10002 /data /config

COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=interfaz /web/dist /srv

# Un Caddyfile inválido rompe la construcción, no el despliegue. caddy validate crea una
# autoridad local con sus llaves privadas: la dejo en una carpeta temporal que se borra en el
# mismo paso, para que ninguna llave quede en la imagen ni con dueño root en /data.
RUN XDG_DATA_HOME=/tmp/validar XDG_CONFIG_HOME=/tmp/validar \
    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
    && rm -rf /tmp/validar

USER 10002:10002
