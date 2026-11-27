# Aletheia 0.52.0

**En una firma el responsable dirige el despacho, los planes tienen tope de adicionales y el espacio de trabajo estrena la campana de avisos.**

- **Responsable de una firma (ADR-062).** En una firma, la persona responsable arma el equipo, paga el plan y fija las políticas, pero no abre casos: los abren sus abogados. Tampoco ocupa cupo, así que una firma en Esencial alcanza para dos abogados, o un abogado y su asistente. En una cuenta independiente nada cambia: quien la crea es el abogado. El inicio de una firma sin casos invita a armar el equipo.
- **Adicionales con tope.** Esencial, Profesional y Firma admiten usuarios adicionales a 19.900 pesos al mes, hasta tantos como los que incluye cada plan: 4, 8 y 20 personas en total. Firma pasa de 14.900 a 19.900 por adicional. Corporativo no tiene límite de personas y se cotiza. Equipo, la página de precios y el cálculo por tamaño del despacho muestran el tope; invitar o pagar por encima responde con lo que admite el plan.
- **Avisos (ADR-063).** La campana del encabezado muestra cuántos avisos faltan por leer y abre un panel con los más recientes: tareas asignadas, casos a los que lo agregan, mensajes de clientes en el portal (sin copiar el texto) y personas que entran al equipo. Cada aviso lleva a la pestaña del caso donde se atiende. Solo la persona destinataria lo ve. Los leídos se borran a los 90 días y todos al año.
- **Avisos que se cierran.** La cuenta regresiva de la prueba y los avisos informativos fijos tienen un botón para cerrarlos. La cuenta regresiva vuelve los últimos tres días, una vez por día. El plan vencido y la verificación del correo no se cierran.
- **Textos legales del 27 de noviembre de 2026.** Los términos explican el cupo de la firma, el tope de adicionales y Corporativo. Quien entre verá el resumen de cambios y aceptará la versión nueva.
- **Revisión visual y técnica.** Se midieron 25 pantallas en escritorio, tablet y celular, en claro y oscuro: sin fallas de contraste, sin desbordes y sin controles sin nombre. Las fuentes tienen respaldos con sus mismas métricas, así que la página ya no salta al cargarlas (el registro pasó de 0,118 a 0,009 de desplazamiento). Casillas, títulos de casos y el enlace de cookies llegan a 24 px. En la base, los avisos se ordenan por fecha con su índice y el portal tipa su estado sin excepciones de mypy.

## Al desplegar

1. Corren las migraciones 0068 (tope de adicionales y precio único de 19.900) y 0069 (tabla `notifications`, sus políticas de fila y la función `purge_old_notifications`).
2. Firma sube su adicional de 14.900 a 19.900. Los términos piden avisar un cambio de precio con 30 días y aplicarlo desde la renovación siguiente: si algún despacho paga Firma con adicionales, hay que avisarle por correo antes de su próxima renovación.
