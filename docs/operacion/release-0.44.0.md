# Aletheia 0.44.0

**Rediseño del espacio de trabajo, modo oscuro, consola del dueño y cumplimiento legal.** Los textos legales pasan a regir desde el **25/11/2026**: quien ya tenía cuenta los acepta de nuevo en su siguiente ingreso, con el resumen de lo que cambió. Siguen necesitando la revisión de un abogado antes de darlos por definitivos.

## Legal

- **Radicado y plazos legales:** cada solicitud de Pedir soporte tiene un tipo (ayuda, consulta o reclamo sobre datos personales, petición o queja de consumidor, reembolso), un radicado `PQR-AAAA-NNNNN` y su fecha límite, contada en días hábiles con los festivos de Colombia (migración 0057).
- **IP y navegador a los 90 días:** la política lo prometía y no se hacía. El trabajador los borra en su mantenimiento (migración 0058).
- **Solicitudes resueltas:** el dueño puede eliminarlas; las de datos personales, consumidor y reembolso solo tres años después de cerradas, y la base lo hace cumplir (migración 0059).
- **Conservación fija:** los casos archivados se conservan diez años para todos los despachos; el plazo ya no se cambia desde la aplicación (migración 0060).
- **Textos:** clientes del portal y descargas compartidas, datos sensibles opcionales, Wompi por nombre, nivel adecuado de Estados Unidos, requisito de ir primero ante el responsable antes de la SIC, garantía del servicio, comunicaciones, fuerza mayor, cesión y la lista completa de lo que se guarda en el navegador.
- **SIC también dentro de la app:** el pie del espacio de trabajo enlaza los textos legales y a la Superintendencia.

## Consola del dueño de la plataforma

- Resumen con lo que exige atención, cifras del negocio, crecimiento de 30 días y vencimientos de la semana.
- Directorio de despachos con plan, consumo y vencimiento, exportable a CSV.
- Tareas y pagos: la cola del trabajador por tipo, las tareas fallidas con su tipo de error y un botón para reintentarlas.
- Rendimiento real reorganizado por celular y escritorio, en lenguaje claro y comparado con la versión anterior.
- Planes y cortesías separados de Ingresos; cada pantalla en su propio archivo.

## Diseño

- Modo claro y oscuro con selector, sin destello al cargar, con símbolo propio para cada modo y contraste AA comprobado.
- Menú lateral con grupos plegables, indicador que se desliza, modo compacto y cajón en celular.
- Botones con respuesta física y variante de peligro; campos, casillas y opciones en tarjeta rediseñados.
- La portada ya no amplía ni desplaza las fotografías.
- Saludo según la hora en Inicio y en el Resumen; avisos repetidos retirados.

## Repositorio

- Fuera el prototipo `backend/spikes`: su informe pasó a `docs/arquitectura/prueba-tecnica-tt006.md` y sus sellos reales a `backend/tests/fixtures`.
- Fuera los archivos de evidencia de desarrollo que estaban versionados en `backend/.local`, ahora ignorado.
