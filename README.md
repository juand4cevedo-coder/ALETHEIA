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

### Revisiones antes de cada commit

El repositorio usa pre-commit para revisar cada commit antes de crearlo. Bloquea secretos con Gitleaks, llaves privadas, archivos de más de 500 KB y marcas de conflicto sin resolver, y normaliza los saltos de línea a LF.

Después de clonar el repositorio, en PowerShell:

```powershell
uv tool install pre-commit
pre-commit install
```

## Derechos de autor

Este repositorio es público para consulta y evaluación, pero no incluye licencia de uso. El código conserva todos los derechos de autor y no puede copiarse, modificarse ni distribuirse sin autorización escrita del autor.

© 2026 Juan Diego Acevedo Calderon.
