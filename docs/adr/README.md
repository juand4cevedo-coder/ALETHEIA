# Registro de decisiones de arquitectura

Cada decisión de arquitectura de ALETHEIA queda en un archivo de esta carpeta con su contexto, las alternativas evaluadas y sus consecuencias. Un ADR aceptado no se edita: si la decisión cambia, se escribe uno nuevo que lo reemplaza y el anterior se marca como reemplazado.

| ADR | Título | Estado | Fecha |
| --- | --- | --- | --- |
| [ADR-001](adr-001.md) | Monolito modular por capas en un monorepo | Aceptado | 15/10/2026 |
| [ADR-002](adr-002.md) | Interfaz y API en el mismo origen detrás de Caddy | Aceptado | 15/10/2026 |
| [ADR-003](adr-003.md) | PostgreSQL como cola de tareas | Aceptado | 15/10/2026 |
| [ADR-004](adr-004.md) | Cadena de custodia de solo inserción con eliminación controlada | Aceptado | 23/10/2026 |
| [ADR-005](adr-005.md) | Cifrado por caso y eliminación por destrucción de llave | Aceptado | 15/10/2026 |
| [ADR-006](adr-006.md) | Aislamiento con filtro por organización y Row-Level Security | Aceptado | 15/10/2026 |
| [ADR-007](adr-007.md) | Sesiones con JWT corto, renovación rotativa en cookies y Argon2id | Aceptado | 15/10/2026 |
| [ADR-008](adr-008.md) | Contrato OpenAPI como fuente única y errores Problem Details | Aceptado | 15/10/2026 |
| [ADR-009](adr-009.md) | UUID versión 7 y paginación por cursor | Aceptado | 15/10/2026 |
| [ADR-010](adr-010.md) | Adaptadores para almacenamiento, sellado, pagos y correo | Aceptado | 15/10/2026 |
| [ADR-011](adr-011.md) | Producción en Azure con VM B1ms y servicios administrados | Reemplazado por ADR-016 | 20/10/2026 |
| [ADR-012](adr-012.md) | Verificación pública en el navegador | Aceptado | 15/10/2026 |
| [ADR-013](adr-013.md) | Herramientas de calidad y verificación continua | Aceptado | 22/10/2026 |
| [ADR-014](adr-014.md) | Biblioteca de cifrado por flujos | Aceptado | 26/10/2026 |
| [ADR-015](adr-015.md) | Sellado de tiempo RFC 3161 | Aceptado | 26/10/2026 |
| [ADR-016](adr-016.md) | Producción en Oracle Cloud con recursos Always Free | Reemplazado por ADR-017 | 27/10/2026 |
| [ADR-017](adr-017.md) | Producción en AWS con el plan gratuito | Aceptado | 29/10/2026 |
| [ADR-018](adr-018.md) | Publicación y despliegue a producción por SSM con etiquetas firmadas | Aceptado, en parte reemplazado por ADR-019 | 30/10/2026 |
| [ADR-019](adr-019.md) | Espera mínima antes de adoptar versiones nuevas | Aceptado | 31/10/2026 |
| [ADR-020](adr-020.md) | Contrato guardado en el repositorio y cliente generado con Hey API | Aceptado | 31/10/2026 |
