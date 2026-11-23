# Aletheia 0.10.0

- Salud del despacho en el inicio de propietarios y administradores: plan y su vencimiento, almacenamiento y cupo de usuarios con barras que avisan al acercarse al límite, y los eventos de seguridad de los últimos siete días (ingresos, ingresos fallidos, sesiones cerradas, cambios de rol, invitaciones). Nuevo `GET /api/v1/organization/health`, solo para gestores.
- Tareas del inicio agrupadas por plazo: vencidas, para hoy, esta semana, más adelante y sin plazo, con el conteo de cada grupo y el día de Colombia como referencia.
- Menú de navegación de escritorio con una captura real del producto por categoría, un ícono en cada enlace y el contenido del panel cargado aparte para no pesar en la primera visita.
- Portada: los títulos y bloques de cada sección entran con un desplazamiento suave y las tarjetas se elevan al apuntarlas. Solo CSS; se apaga con movimiento reducido.
- Captura del carrusel completa y centrada, menú móvil animado, fotografía de fondo en el pie y título de las pestañas con la marca primero.
- Vigilancia, respaldos y presupuesto de la plataforma (versiones 0.9.0 y 0.9.1): sin cambios en esta versión.

Esta versión no trae migraciones. Agrega un endpoint de solo lectura y no cambia los existentes.
