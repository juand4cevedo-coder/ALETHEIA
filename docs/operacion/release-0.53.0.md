# Aletheia 0.53.0

**Revisión visual y técnica completa en celular, tablet y escritorio: la página del caso cabe en el celular, la renovación cobra bien a los equipos grandes y todos los controles hablan el mismo idioma.**

- **Cobro de la renovación automática.** El tope de adicionales de la 0.52.0 frenaba también el cobro de un equipo que ya lo pasaba: la renovación cobraba solo el plan y el pago se rechazaba. Ahora el tope solo frena invitar o comprar un plan; la renovación cobra a todas las personas del equipo.
- **Caso en el celular.** La página del caso medía 739 px en una pantalla de 390 y recortaba título, pestañas y botones. Ahora mide lo que la pantalla en todas sus pestañas. Se revisaron las 30 rutas en 390 y 834 px y ninguna se sale.
- **Avisos que llevan a otra pestaña.** Si un aviso lleva a otra pestaña del mismo caso, la pestaña cambia.
- **Responsable de una firma.** Abrir un caso le explica por qué no puede y lo lleva a Equipo. Empresa, la ayuda y el blog cuentan bien quién abre casos y cuántas personas ocupan cupo.
- **Sin tecnicismos.** La auditoría dice el equipo en palabras («Edge en Windows») y las fechas legibles; el detalle de una prueba dice «Correo» y «Texto plano» en lugar de email y text/plain; Mi cuenta muestra fechas legibles y un estado claro.
- **Controles del sistema.** Banco de datos, Casos archivados, Equipo, Auditoría, el comprobador y la consola usan los selectores y las fechas del sistema. Revocar un enlace, borrar una plantilla y las acciones de la consola confirman con un diálogo propio en lugar del cuadro del navegador.
- **Composición.** Pruebas del caso a dos columnas en pantallas anchas, con el formulario fijo; datos procesales fijos al recorrer la cadena; cifras sin tarjetas huérfanas en el inicio y en Banco de datos; resumen de tareas compacto en el celular; Organización y Mi cuenta con espacios y botones parejos; selector de archivos del portal con el estilo del producto.
- **Sin saltos al cargar.** «Salud del despacho» reserva su alto mientras carga: el desplazamiento del inicio en tablet pasa de 0,12 a 0,006.
- **Accesibilidad.** Radios de 24 px; ayuda del rol alineada con su campo; el efecto al desplazar queda solo en el sitio público y no se aplica al imprimir.
- **Consola de la plataforma.** Muestra y edita el tope de adicionales de cada plan.

## Al desplegar

Sin migraciones nuevas. La renovación automática sigue apagada en producción; la corrección rige cuando se encienda.
