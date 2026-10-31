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
| `ALETHEIA_DATABASE_PASSWORD_PARAMETER` y `ALETHEIA_MIGRATION_DATABASE_PASSWORD_PARAMETER` | Solo en producción | No se definen: fuera de producción la API las rechaza |

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

### Contrato de la API

El backend guarda su contrato OpenAPI en `backend/openapi.json`, y el frontend genera desde ese archivo sus tipos y su cliente HTTP en `frontend/src/api/generated` (ADR-008 y ADR-020). Ninguno de los dos se edita a mano. Cada vez que cambie una ruta, un esquema o la versión de la API, se regeneran ambos y se guardan en el mismo commit que el cambio:

```powershell
cd backend
uv run python -m app.contract
cd ../frontend
pnpm api:generate
```

La prueba `tests/test_contract.py` falla si el contrato guardado no coincide con la API o si su versión no es la de `pyproject.toml`, y la CI falla si el cliente generado no coincide con el contrato. Los errores se documentan como Problem Details: `Problem` para cualquier 4xx o 5xx y `ValidationProblem` para los 422.

### Frontend

```powershell
cd frontend
pnpm install
pnpm dev
```

En desarrollo, Vite reenvía `/api` a la API local en el puerto 8000, así que la interfaz llama al mismo origen, igual que en producción detrás de Caddy.

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
pnpm api:generate
git status --short src/api/generated
pnpm lint
pnpm format:check
pnpm build
```

El segundo comando no debe listar nada: si lista archivos, el cliente generado no estaba al día.

## Producción

Producción corre en AWS (ADR-017) y se despliega desde GitHub Actions, con aprobación manual, al subir una etiqueta firmada (ADR-018). La infraestructura, el despliegue y cómo operarlos están en `docs/operacion/produccion.md`.

En producción la API no recibe claves. Su URL llega sin clave y la API la lee de Parameter Store al arrancar, con el rol de la máquina. Si se define el parámetro, la URL no puede traer clave; y en producción el parámetro es obligatorio.

| Variable | Valor en producción |
| --- | --- |
| `ALETHEIA_ENVIRONMENT` | `production` |
| `ALETHEIA_LOG_LEVEL` | `INFO` |
| `ALETHEIA_DATABASE_URL` | `postgresql+psycopg://aletheia_app@postgres:5432/aletheia` |
| `ALETHEIA_DATABASE_PASSWORD_PARAMETER` | `/aletheia/prod/postgres/app-password` |
| `ALETHEIA_MIGRATION_DATABASE_URL` | `postgresql+psycopg://aletheia_owner@postgres:5432/aletheia` |
| `ALETHEIA_MIGRATION_DATABASE_PASSWORD_PARAMETER` | `/aletheia/prod/postgres/owner-password` |
| `AWS_DEFAULT_REGION` | `us-east-2` |

Para publicar una versión:

1. En la rama `release/X.Y.Z`, sube la versión en `backend/pyproject.toml`, `backend/app/main.py` y `frontend/package.json`, regenera el contrato y el cliente (sección Contrato de la API) y abre el pull request hacia main.
2. Con el pull request integrado, crea la etiqueta firmada sobre main y súbela:

```powershell
git switch main
git pull
git tag -s vX.Y.Z -m "ALETHEIA X.Y.Z"
git push origin vX.Y.Z
```

3. En la pestaña Actions de GitHub, abre la ejecución de Publicar y aprueba el despliegue cuando lo pida.

## Derechos de autor

Este repositorio es público para consulta y evaluación, pero no incluye licencia de uso. El código conserva todos los derechos de autor y no puede copiarse, modificarse ni distribuirse sin autorización escrita del autor.

© 2026 Juan Diego Acevedo Calderon.
