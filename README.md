# ALETHEIA

Plataforma web para que abogados en Colombia preserven evidencia digital y puedan demostrar su integridad y trazabilidad. ALETHEIA conserva el archivo original, calcula su huella SHA-256, obtiene un sello de tiempo de un tercero y registra cada acción en una cadena de custodia que no se puede alterar sin que se note.

ALETHEIA preserva y documenta. No determina la autenticidad, la veracidad, la admisibilidad ni el valor probatorio de una evidencia, y no emite certificados.

## Estado

En construcción. Las instrucciones de instalación, desarrollo y despliegue se agregan a medida que cada parte del sistema existe.

## Tecnologías

- Backend: Python, FastAPI, SQLAlchemy y Alembic.
- Frontend: React, TypeScript y Vite.
- Base de datos: PostgreSQL.
- Contenedores: Docker y Docker Compose.

## Desarrollo

### Requisitos

- Python 3.14 con uv 0.13 o posterior. La versión exacta está fijada en `backend/.python-version`.
- Node.js 26 con pnpm 12.
- Docker Engine 29 con Docker Compose 5. En Windows se ejecuta dentro de WSL 2.
- Visual Studio Code con las extensiones que recomienda el repositorio.

### Servicios locales

PostgreSQL, Azurite (emulador de Azure Blob Storage) y Mailpit (captura de correos) corren en contenedores. Sus puertos solo escuchan en 127.0.0.1 y sus datos se guardan en volúmenes de Docker.

1. Copia `infra/.env.example` como `infra/.env` y define una clave propia. Ese archivo nunca entra al repositorio.
2. Desde la raíz del repositorio:

```powershell
docker compose -f infra/compose.dev.yaml up -d   # levantar los servicios
docker compose -f infra/compose.dev.yaml ps      # revisar su estado
docker compose -f infra/compose.dev.yaml down    # apagarlos sin borrar los datos
```

| Servicio | Dirección |
| --- | --- |
| PostgreSQL | 127.0.0.1:5432 |
| Azurite, Blob Storage | http://127.0.0.1:10000 |
| Mailpit, SMTP | 127.0.0.1:1025 |
| Mailpit, bandeja web | http://127.0.0.1:8025 |

### Backend

```powershell
cd backend
uv sync
```

### Frontend

```powershell
cd frontend
pnpm install
pnpm dev
```

### Revisiones antes de cada commit

El repositorio usa pre-commit para revisar cada commit antes de crearlo. Bloquea secretos con Gitleaks, llaves privadas, archivos de más de 500 KB y marcas de conflicto sin resolver, y normaliza los saltos de línea a LF.

Después de clonar el repositorio, en PowerShell:

```powershell
uv tool install pre-commit
pre-commit install
```
## Revisiones antes de abrir un pull request

Cada pull request pasa por la integración continua, que ejecuta las mismas revisiones de esta sección. Correrlas antes en el equipo evita esperar a que GitHub encuentre el error.

Backend, desde `backend/` y con los servicios de Compose encendidos. La URL usa el usuario, la clave y la base definidos en `infra/.env`:

```powershell
uv run ruff check
uv run ruff format --check
uv run mypy
$env:ALETHEIA_TEST_DATABASE_URL = "postgresql://USUARIO:CLAVE@127.0.0.1:5432/BASE"
uv run pytest
```

Frontend, desde `frontend/`:

```powershell
pnpm lint
pnpm format:check
pnpm build
```

## Derechos de autor

Este repositorio es público para consulta y evaluación, pero no incluye licencia de uso. El código conserva todos los derechos de autor y no puede copiarse, modificarse ni distribuirse sin autorización escrita del autor.

© 2026 Juan Diego Acevedo Calderon.
