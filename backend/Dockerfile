# Imagen de la API de ALETHEIA para linux/amd64. Sirve también para el contenedor migrate, que
# usa esta misma imagen con el comando alembic upgrade head. Se construye desde la raíz:
#   docker build --platform linux/amd64 -t aletheia-api backend
#
# Python 3.14.9 fijado por digest: la misma versión de backend/.python-version, de desarrollo y
# de la CI. La excepción a la regla de los 14 días está registrada en ADR-019.

# --- Etapa 1: dependencias --------------------------------------------------------------
FROM python:3.14.9-slim-trixie@sha256:35caba83af2fe6da9a5d922f9b0156f21d1246a48278c58a08bd253303ba42e8 AS dependencias

# uv 0.13.5: el mismo archivo y la misma suma SHA-256 que verifica la CI. Si el archivo cambia,
# la construcción falla. Solo existe en esta etapa; la imagen final no lo lleva.
ADD --checksum=sha256:f68d291c75783122dad58ab77def0e13f3233f358731db5d6d7e8715603b928f \
    https://github.com/astral-sh/uv/releases/download/0.13.5/uv-x86_64-unknown-linux-gnu.tar.gz \
    /tmp/uv.tar.gz
RUN tar --extract --gzip --file /tmp/uv.tar.gz --directory /usr/local/bin --strip-components 1 \
    && rm /tmp/uv.tar.gz

# Instala en /opt/venv exactamente lo que fija uv.lock, sin las herramientas de desarrollo.
# Usa el Python de la imagen y nunca descarga otro; compila los .pyc para arrancar más rápido.
ENV UV_LOCKED=1 \
    UV_NO_DEV=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /build
COPY pyproject.toml uv.lock .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --no-install-project

# --- Etapa 2: imagen final --------------------------------------------------------------
FROM python:3.14.9-slim-trixie@sha256:35caba83af2fe6da9a5d922f9b0156f21d1246a48278c58a08bd253303ba42e8

LABEL org.opencontainers.image.source="https://github.com/juand4cevedo-coder/ALETHEIA" \
      org.opencontainers.image.title="aletheia-api" \
      org.opencontainers.image.description="API de ALETHEIA: preservación de evidencia digital."

# Usuario propio sin privilegios, sin carpeta personal y sin consola.
RUN groupadd --system --gid 10001 aletheia \
    && useradd --system --uid 10001 --gid aletheia --no-create-home \
       --home-dir /nonexistent --shell /usr/sbin/nologin aletheia

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=dependencias /opt/venv /opt/venv

WORKDIR /app
# Solo el código. El dueño es root y el usuario aletheia solo puede leerlo: si alguien tomara
# el proceso, no podría modificar la aplicación.
COPY app ./app
COPY migrations ./migrations
# Alembic lee su configuración de [tool.alembic] en pyproject.toml.
COPY pyproject.toml ./

# Numérico: así cualquier herramienta comprueba que no es root sin consultar /etc/passwd.
USER 10001:10001
EXPOSE 8000

# Solo Caddy llega a este puerto (la API no publica puertos en Compose), por eso se aceptan
# las cabeceras X-Forwarded-* de cualquier origen de la red interna: así la API ve la IP
# real del visitante y el esquema https.
CMD ["uvicorn", "app.main:create_app", "--factory", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*", \
     "--no-server-header", "--timeout-graceful-shutdown", "20"]
