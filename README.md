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

PostgreSQL y Mailpit (captura de correos) corren en contenedores. Sus puertos solo escuchan en 127.0.0.1 y sus datos se guardan en volúmenes de Docker. En desarrollo los archivos cifrados de las evidencias se guardan en una carpeta local, así que no hace falta emular el almacenamiento de producción.

1. Copia `infra/.env.example` como `infra/.env` y define las cuatro claves, cada una distinta. Ese archivo nunca entra al repositorio.
2. Desde la raíz del repositorio:

```powershell
docker compose -f infra/compose.dev.yaml up -d   # levantar los servicios
docker compose -f infra/compose.dev.yaml ps      # revisar su estado
docker compose -f infra/compose.dev.yaml down    # apagarlos sin borrar los datos
```

| Servicio | Dirección |
| --- | --- |
| PostgreSQL | 127.0.0.1:5432 |
| Mailpit, SMTP | 127.0.0.1:1025 |
| Mailpit, bandeja web | http://127.0.0.1:8025 |

En su primer arranque, con el volumen vacío, PostgreSQL ejecuta `infra/postgres/bootstrap.sql`: crea los tres usuarios de ALETHEIA y una segunda base, `aletheia_test`, para las pruebas del backend. Si cambias alguna clave de `infra/.env`, recrea el volumen con `docker compose -f infra/compose.dev.yaml down -v`; ese comando borra los datos locales.

| Usuario | Quién lo usa | Puede |
| --- | --- | --- |
| `aletheia` | Administración manual | Todo; la aplicación nunca se conecta con él |
| `aletheia_owner` | Migraciones de Alembic | Crear y modificar el esquema |
| `aletheia_app` | API y trabajador | Leer y escribir datos, sin cambiar el esquema |
| `aletheia_support` | Consultas de soporte | Solo leer |

### Backend

```powershell
cd backend
uv sync
Copy-Item .env.example .env
```

Abre `backend/.env` y reemplaza cada `CLAVE` por la del usuario correspondiente en `infra/.env`. Ese archivo nunca entra al repositorio.

| Variable | Obligatoria | Valor en desarrollo |
| --- | --- | --- |
| `ALETHEIA_DATABASE_URL` | Sí | `postgresql+psycopg://aletheia_app:CLAVE@127.0.0.1:5432/aletheia` |
| `ALETHEIA_ENVIRONMENT` | No | `development`; los otros valores son `test` y `production` |
| `ALETHEIA_LOG_LEVEL` | No | `DEBUG`; fuera de `development` solo se aceptan `INFO`, `WARNING` y `ERROR` |
| `ALETHEIA_MIGRATION_DATABASE_URL` | Solo para migraciones | `postgresql+psycopg://aletheia_owner:CLAVE@127.0.0.1:5432/aletheia` |

Con los servicios de Compose encendidos:

```powershell
uv run uvicorn app.main:create_app --factory
```

| Dirección | Contenido |
| --- | --- |
| http://127.0.0.1:8000/api/v1/health | Estado de la API y de la base de datos: 200 o 503 |
| http://127.0.0.1:8000/api/v1/docs | Documentación interactiva de la API |

Si falta una variable obligatoria o tiene un valor inválido, la API no arranca e indica el campo sin mostrar su valor. Los registros salen en JSON por la salida estándar; cada petición lleva un `request_id`, que también viaja en la cabecera `X-Request-ID` y en cada respuesta de error.

### Migraciones de la base de datos

El esquema se construye con migraciones de Alembic guardadas en `backend/migrations`. Desde `backend/` y con los servicios de Compose encendidos:

```powershell
uv run alembic upgrade head
uv run alembic current
```

El primer comando aplica las migraciones pendientes y el segundo muestra en qué versión está la base. Para revisar el SQL de una migración sin tocar la base, agrega `--sql` al primero.

Alembic se conecta con `ALETHEIA_MIGRATION_DATABASE_URL`, es decir, con `aletheia_owner`, y se niega a correr como superusuario: si lo hiciera, las tablas quedarían a nombre del administrador y los permisos de la aplicación no se aplicarían. Las migraciones nuevas se crean con `uv run alembic revision -m "descripción"`, y Ruff las corrige y formatea al generarlas.

### Aislamiento por organización

Las tablas que pertenecen a una organización tienen Row-Level Security: PostgreSQL solo entrega y acepta filas de la organización fijada en la transacción. Todo código que use una sesión de SQLAlchemy sobre esas tablas fija antes el contexto:

```python
from app.db.tenancy import TenantContext, set_tenant

set_tenant(session, TenantContext(organization_id=organizacion, user_id=persona))
```

Sin contexto, las consultas no devuelven filas y las escrituras se rechazan. La cadena de custodia solo admite inserciones, y un caso se elimina únicamente con la función `purge_case`, que primero deja la constancia de eliminación.

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

### Revisiones antes de abrir un pull request

Cada pull request pasa por la integración continua, que ejecuta las mismas revisiones de esta sección. Correrlas antes en el equipo evita esperar a que GitHub encuentre el error.

Backend, desde `backend/` y con los servicios de Compose encendidos:

```powershell
uv run ruff check
uv run ruff format --check
uv run mypy
$env:ALETHEIA_TEST_DATABASE_URL = ((Get-Content .env | Where-Object { $_ -like 'ALETHEIA_DATABASE_URL=*' }) -split '=', 2)[1].Trim() -replace '/aletheia$', '/aletheia_test'
$env:ALETHEIA_TEST_MIGRATION_DATABASE_URL = ((Get-Content .env | Where-Object { $_ -like 'ALETHEIA_MIGRATION_DATABASE_URL=*' }) -split '=', 2)[1].Trim() -replace '/aletheia$', '/aletheia_test'
uv run pytest
```

Las pruebas usan la base `aletheia_test`, nunca la de desarrollo. Al empezar reconstruyen su esquema con las migraciones, y cada prueba corre dentro de una transacción que se deshace al terminar, así que no dejan datos. Las dos variables toman las URL de `backend/.env` y solo cambian el nombre de la base, de modo que la clave no aparece en pantalla ni en el historial de PowerShell. pytest muestra los fallos en formato corto, sin los argumentos de las pruebas, para que la URL tampoco aparezca en su salida.

Frontend, desde `frontend/`:

```powershell
pnpm lint
pnpm format:check
pnpm build
```

## Derechos de autor

Este repositorio es público para consulta y evaluación, pero no incluye licencia de uso. El código conserva todos los derechos de autor y no puede copiarse, modificarse ni distribuirse sin autorización escrita del autor.

© 2026 Juan Diego Acevedo Calderon.
