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
| `ALETHEIA_SMTP_HOST` y `ALETHEIA_SMTP_PORT` | No | `127.0.0.1` y `1025`, el Mailpit de Compose |
| `ALETHEIA_TOKEN_SIGNING_KEY` | Sí, para los enlaces de los correos y las sesiones | Al menos 32 caracteres aleatorios: `uv run python -c "import secrets; print(secrets.token_urlsafe(48))"`. En producción se lee de Parameter Store |
| `ALETHEIA_DEV_PUBLIC_URL` | No | `http://localhost:5173`, la dirección de los enlaces fuera de producción |
| `ALETHEIA_LOCAL_KEY_PATH` | Sí, fuera de producción | `../infra/dev-key.pem`, la llave con la que se envuelven las llaves de los casos. En producción no se define: la maestra vive en AWS KMS y la API rechaza la variable |

La llave local se genera una sola vez, desde `backend/`. `*.pem` está en `.gitignore`, así que `infra/dev-key.pem` nunca entra al repositorio:

```powershell
uv run python -c "from cryptography.hazmat.primitives import serialization as s; from cryptography.hazmat.primitives.asymmetric import rsa; k = rsa.generate_private_key(public_exponent=65537, key_size=3072); open('../infra/dev-key.pem', 'wb').write(k.private_bytes(s.Encoding.PEM, s.PrivateFormat.PKCS8, s.NoEncryption()))"
```

Si se pierde o se reemplaza esa llave, los casos creados con ella dejan de poder abrirse en ese equipo: solo sirve para desarrollo.

Con los servicios de Compose encendidos:

```powershell
uv run python -m uvicorn app.main:create_app --factory
```

| Dirección | Contenido |
| --- | --- |
| http://127.0.0.1:8000/api/v1/health | Estado de la API y de la base de datos: 200 o 503 |
| http://127.0.0.1:8000/api/v1/docs | Documentación interactiva de la API |

Los correos y las demás tareas en segundo plano los ejecuta el trabajador, en otra terminal y desde `backend/`:

```powershell
uv run python -m app.worker
```

Toma las tareas de la tabla `jobs` y reintenta las que fallan con espera creciente. Fuera de producción todo correo va a Mailpit, así que se lee en http://127.0.0.1:8025 y nunca sale a internet. Con Ctrl+C termina la tarea en curso antes de salir.

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

Sin contexto, las consultas no devuelven filas y las escrituras se rechazan. Es aislamiento lógico contra consultas mal escritas o filtros olvidados, no una barrera frente a quien tenga las credenciales de `aletheia_app`, que puede fijar cualquier contexto (ADR-039). La cadena de custodia solo admite inserciones y la base calcula el hash de cada evento; `app.services.custody_chain` lo verifica por su cuenta, sin funciones de la base (ADR-037). Un caso se elimina únicamente con la función `purge_case`, que comprueba que lo pida la persona de la sesión con rol de propietario o administrador y primero deja la constancia de eliminación.

### Sesiones y protección contra CSRF

Al ingresar, la API entrega dos cookies HttpOnly, Secure y SameSite=Strict: la de acceso, de 10 minutos, y la de renovación, que solo viaja a `/api/v1/auth` (ADR-007 y ADR-028). Una ruta que exige sesión declara la dependencia `get_principal`:

```python
from app.api.deps import get_principal
from app.services.sessions import Principal

def ruta(principal: Annotated[Principal, Depends(get_principal)]) -> ...:
```

La dependencia comprueba en cada petición que la sesión siga viva, responde 401 si no, y deja fijado el contexto de la organización de la persona. `Principal` trae la persona, su sesión, su organización y su rol.

Las rutas que gestionan el equipo, como las de `/api/v1/organization`, declaran `get_manager` en su lugar: además de la sesión exige que la persona sea propietaria o administradora (RN-008) y responde 403 con MSG-010 a los demás roles. Los servicios vuelven a comprobar el rol, así que la autorización no depende de que una ruta recuerde pedir la dependencia.

Toda petición que cambia algo (POST, PUT, PATCH o DELETE) debe llevar el encabezado `X-Aletheia-Request: 1`; sin él, o si viene de otro sitio, la API responde 403. La interfaz lo envía siempre. Para probar la API desde PowerShell 7 hay que agregarlo:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/auth/login `
    -Headers @{ "X-Aletheia-Request" = "1" } -ContentType "application/json" `
    -Body '{"email": "ana@example.com", "password": "su contraseña"}'
```

Las cookies son Secure, así que en desarrollo el navegador solo las guarda en `http://localhost:5173`, que trata como origen seguro; con `127.0.0.1` no las guarda.

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

El código del frontend se organiza así (ADR-021):

| Carpeta | Contenido |
| --- | --- |
| `src/routes` | Las rutas del sitio con React Router y `QueryRoot`, el proveedor de TanStack Query del acceso y del espacio de trabajo |
| `src/layouts` | Los marcos que comparten varias páginas, como el encabezado y el pie del sitio público |
| `src/pages` | Una página por ruta |
| `src/features/<dominio>` | Componentes y funciones de un dominio, por ejemplo `billing` para planes y precios |
| `src/components/ui` | Componentes del sistema de diseño que usan varias páginas: botón, campo, huella, número de radicado, insignia de estado e íconos (`icons.tsx`) |
| `src/features/landing` | Las secciones de la página de inicio, una por archivo |
| `src/features/legal` | El texto de las cuatro políticas legales, uno por archivo, que muestra la página `/legal/<política>` |
| `src/features/consent` | El panel de cookies y la elección del visitante, que se guarda en el almacenamiento local del navegador |
| `src/styles` | Los tokens del sistema de diseño y los estilos globales |
| `src/config` | Datos del sitio que se repiten: el correo de contacto, las rutas públicas y, en `legal.ts`, la versión vigente de las políticas y los datos del responsable |
| `src/test` | Lo que comparten las pruebas: configuración, catálogo de ejemplo y revisión con axe |
| `public` | Archivos que se publican tal cual: íconos, imagen para redes, `robots.txt` y `sitemap.xml` |
| `src/api/generated` | El cliente generado desde el contrato; no se edita a mano |
| `src/api/runtimeConfig.ts` | La configuración con que nace el cliente generado: el encabezado propio que la API exige contra CSRF |

El acceso y el espacio de trabajo piden los datos de la API con TanStack Query y las opciones que genera Hey API, por ejemplo `useQuery(readMeOptions())`. El proveedor lo monta `src/routes/QueryRoot.tsx`, que se descarga con esas pantallas. El sitio público no usa TanStack Query: el inicio y la página de precios leen el catálogo de planes con `usePlanCatalog()` (`src/features/billing/catalog.tsx`), un `fetch` pequeño que la landing carga sin el resto del cliente.

Los estilos de cada componente van en su archivo `.module.css` y usan solo las variables de `src/styles/tokens.css` (ADR-043). Una prueba falla si algún archivo usa los nombres del sistema anterior, como `--color-ink-900`. Al imprimir, `tokens.css` cambia los tonos de texto, enlaces y estados a tinta oscura sobre blanco.

Los íconos se importan solo de `src/components/ui/icons.tsx`: Phosphor en peso regular, copiado en `src/components/ui/icons/` con un archivo por ícono, más cuatro propios (huella, sello, cadena y paquete). Para agregar uno, se copia su trazado regular de Phosphor en un archivo nuevo de esa carpeta, igual a los demás, y se exporta desde `icons.tsx`. Como cada ícono vive en su archivo, cada pantalla descarga solo los que dibuja.

Las fuentes son Inter, Instrument Serif y Geist Mono, alojadas en el propio sitio con subconjunto latino (`src/styles/fonts.css`). Mientras cargan se ve la fuente del sistema, e Inter se precarga en `index.html`.

La landing tiene un presupuesto de carga (especificación de identidad, sección 8): menos de 120 KB de JavaScript inicial comprimido y menos de 30 KB de CSS. El script `frontend/scripts/check-bundle-budget.mjs` mide la entrada y sus dependencias estáticas al ejecutar `pnpm build`; las secciones debajo del primer pantallazo llegan aparte (`src/features/landing/BelowFold.tsx`). La escena criptográfica del inicio usa SVG y CSS, sin WebGL.

Las políticas legales comparten una sola versión y fecha de vigencia, definidas en `src/config/legal.ts`. Si un cambio de texto altera derechos u obligaciones, se sube la versión ahí y en ningún otro lugar: el registro guarda qué versión aceptó cada persona.

El sitio solo usa las cookies de sesión. Cualquier herramienta no esencial que se agregue, como una de analítica, se carga únicamente si `hasCookieConsent("analytics")` devuelve `true`, y su llegada sube `CONSENT_VERSION` en `src/features/consent/cookieConsent.ts` para que el panel vuelva a preguntar.

Las pantallas bajo `/app` exigen sesión. Su marco, `AppShell`, consulta `GET /api/v1/me` antes de mostrar nada: sin sesión lleva a `/ingresar` (si la sesión venció, con el aviso MSG-012) y, al entrar, la persona vuelve a la pantalla que intentaba abrir. El menú lateral (`WorkspaceNav`) lista las secciones que ya existen y cada persona ve solo las de su rol: Miembros aparece solo al propietario y al administrador; facturación, bandeja de soporte y auditoría transversal solo a la cuenta propietaria de plataforma. Cualquier cuenta puede abrir y consultar sus propias solicitudes de soporte. Una sección nueva se agrega en `ITEMS`, con su regla de visibilidad si la tiene.

Las pruebas de componentes usan Vitest, Testing Library y axe-core (ADR-022). Cada prueba vive junto al archivo que prueba, con el sufijo `.test.tsx`. `pnpm test` las ejecuta una vez y `pnpm test:watch` las repite cada vez que se guarda un archivo.

### Revisiones antes de cada commit

El repositorio usa pre-commit para revisar cada commit antes de crearlo. Bloquea secretos con Gitleaks, llaves privadas, archivos de más de 500 KB y marcas de conflicto sin resolver, y normaliza los saltos de línea a LF.

Después de clonar el repositorio, en PowerShell:

```powershell
winget install --id Gitleaks.Gitleaks --exact
uv tool install pre-commit
pre-commit install
```

Gitleaks se instala aparte porque el gancho usa la copia del sistema: la que compila pre-commit queda bloqueada por el control de aplicaciones de Windows.

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

Las pruebas del correo envían a Mailpit y leen lo que llegó en http://127.0.0.1:8025; si Mailpit está en otra dirección, se indica en `ALETHEIA_TEST_MAILPIT_URL`. Las pruebas usan la base `aletheia_test`, nunca la de desarrollo. Al empezar reconstruyen su esquema con las migraciones, y cada prueba corre dentro de una transacción que se deshace al terminar, así que no dejan datos. Las dos variables toman las URL de `backend/.env` y solo cambian el nombre de la base, de modo que la clave no aparece en pantalla ni en el historial de PowerShell. pytest muestra los fallos en formato corto, sin los argumentos de las pruebas, para que la URL tampoco aparezca en su salida.

Frontend, desde `frontend/`:

```powershell
pnpm api:generate
git status --short src/api/generated
pnpm lint
pnpm format:check
pnpm test
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
| `ALETHEIA_TOKEN_SIGNING_KEY_PARAMETER` | `/aletheia/prod/app/token-signing-key` |
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
