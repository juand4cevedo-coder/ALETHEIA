# Análisis competitivo y hoja de ruta por rol

| Campo | Contenido |
| --- | --- |
| Fecha | 22 de noviembre de 2026 |
| Alcance | Productos que gestionan evidencia digital, preservan contenido web o administran un despacho jurídico, y cómo los paneles de Aletheia pueden acercarse a lo mejor de cada uno |
| Método | Revisión de páginas de producto, reseñas y artículos. Casi todo lo que dicen los proveedores es información propia: sirve para ver patrones, no para medir calidad |

## 1. Quiénes compiten y por qué

No encontré una plataforma colombiana que combine en un solo producto la preservación de evidencia con huella, la cadena de custodia verificable, el sello de tiempo y un paquete que un tercero pueda comprobar. Lo más cercano está repartido en cuatro grupos.

| Grupo | Productos | Qué resuelven | Qué les falta frente a Aletheia |
| --- | --- | --- | --- |
| Gestión de evidencia | [Axon Evidence](https://www.axon.com/au/products/axon-evidence), CaseTracks, CivicDocs | Registro de acciones por usuario, permisos por grupo, compartir en línea, redacción sobre una copia, retención programada | Están pensados para fiscalías y policía, con precios y contratos de agencia. Casi no atienden a un despacho pequeño en español |
| Captura de contenido web | [Page Vault](https://www.page-vault.com/), Hanzo, [Perma.cc](https://perma.cc/) | Capturan una página o una red social con metadatos, huella y una declaración jurada | Solo cubren contenido web. No custodian archivos propios del cliente, como chats exportados, correos o audios |
| Gestión del despacho | [Clio](https://www.clio.com/features/), MyCase, Smokeball | Tablero del asunto, tareas, calendario con plazos judiciales, portal para el cliente, facturación | No preservan evidencia con huella ni custodia. Tratan los archivos como documentos de trabajo |
| Certificación en Colombia | Certicámara y peritos informáticos | Firma electrónica, autenticación y dictamen pericial sobre un chat o un correo | Un servicio por encargo, no un espacio de trabajo continuo. La [prueba de un chat](https://www.asuntoslegales.com.co/consumidor/como-certificar-un-chat-de-whatsapp-para-que-funcione-como-prueba-en-un-proceso-judicial-3094511) suele exigir certificar su huella |

El hueco es claro: preservar y documentar, en español y a precio de despacho pequeño. Aletheia no certifica ni dictamina; eso sigue siendo del perito. Lo que sí puede hacer es dejarle el trabajo hecho.

## 2. Patrones que se repiten en los mejores

1. **Cada acción deja rastro.** Axon registra toda acción de cualquier usuario sobre una evidencia desde que se sube. Aletheia ya lo hace en la cadena de custodia; falta mostrar la lectura, la descarga y la exportación como eventos visibles.
2. **Permisos por persona y por grupo.** Quien administra decide qué archivos ve cada quien. Aletheia lo resuelve por caso y por rol; falta una vista que muestre, en una sola pantalla, quién ve qué.
3. **Compartir sin entregar el original.** Enlaces con vencimiento y copias redactadas que no tocan el original. Aletheia ya tiene el paquete con enlace de 24 horas; falta compartir una sola evidencia y una vista pública de verificación.
4. **Retención programada.** Regla por tipo de caso y no caso por caso. Aletheia ya conserva y archiva por caso; falta una política por defecto del despacho y avisos antes de vencer.
5. **Tablero del asunto.** Clio reúne en una vista contactos, documentos, calendario, notas y tiempo. Aletheia reúne cadena, equipo, tareas, evidencias y paquete, pero no tiene calendario ni notas.
6. **Plazos en calendario.** Es lo que más usa un abogado a diario. Aletheia tiene tareas con fecha, pero no una vista de calendario ni recordatorios.
7. **Portal del cliente.** Mensajes y documentos con el cliente fuera del correo. Es un rol nuevo con implicaciones legales; se trata aparte.
8. **Búsqueda en todo.** MyCase y Smokeball destacan la búsqueda de texto completo. Aletheia busca casos por título, radicado y despacho, no evidencias ni tareas.

## 3. Estado actual por rol

| Rol | Hoy puede | Se siente corto en |
| --- | --- | --- |
| Responsable del despacho y administrador | Ver el tablero, gestionar miembros, invitar, cambiar el nombre del despacho, consultar la auditoría de seguridad, elegir el plan | El tablero solo cuenta casos. No muestra el uso del almacenamiento, ni quién tiene tareas vencidas, ni alertas de retención. La organización solo tiene un campo. No hay política de seguridad propia (por ejemplo, exigir segundo factor) |
| Abogado | Abrir casos, subir evidencia, asignar tareas, pedir paquetes, cerrar y archivar | No hay calendario, notas del caso, búsqueda entre evidencias, plantillas de tareas ni carga por arrastre con progreso |
| Asistente | Ver sus casos, subir evidencia y completar tareas asignadas | Entra a una bandeja sin contexto de qué sigue hoy. Subir un archivo exige un selector del sistema poco claro |
| Cuenta de plataforma | Gestionar cuentas, soporte, facturación y auditoría sin entrar a expedientes | Faltan métricas de uso, estado de la cola de trabajos y alertas operativas |

## 4. Propuesta por rol

### Responsable del despacho y administrador

- **Salud del despacho**, en el inicio: almacenamiento usado contra la cuota con una barra, usuarios en uso, casos por estado, tareas vencidas por persona y eventos de seguridad de la última semana.
- **Políticas del despacho**: retención por defecto, exigir segundo factor a todo el equipo y duración de sesión.
- **Exportar la auditoría** a CSV con filtros, para entregarla a un cliente o a un perito.
- **Vista de accesos**: una tabla de personas por casos que muestra quién ve qué y permite corregirlo sin entrar a cada caso.
- **Facturación visible**: plan, próximo cobro, historial de pagos y facturas.

### Abogado

- **Mi día**: tareas de hoy y de la semana, plazos que vencen, casos con actividad nueva, en una sola columna.
- **Calendario de plazos**: vista de mes y de semana con las fechas límite de las tareas, y suscripción en formato iCal para llevarlas al calendario personal.
- **Notas del caso**, privadas o del equipo, con fecha y autor, fuera de la cadena de custodia.
- **Búsqueda global** con atajo de teclado: casos, evidencias por nombre y tipo, tareas y personas.
- **Plantillas de tareas** por tipo de proceso, para abrir un caso con su lista inicial.
- **Compartir una evidencia**: enlace con vencimiento a un solo archivo y certificado de integridad en PDF por evidencia.
- **Carga por arrastre** con varios archivos, progreso y huella visible al terminar.

### Asistente

- **Inicio con lo que toca hoy**, no con el resumen del despacho.
- **Lista de ingreso** al abrir una evidencia: origen, tipo y fecha de los hechos.
- **Carga desde el celular**, pensada para fotos y audios.

### Cuenta de plataforma

- **Estado del servicio** y de la cola de trabajos, con trabajos fallidos y reintentos.
- **Uso por despacho**: almacenamiento, casos y evidencias, sin abrir contenido.
- **Alertas**: cuentas cerca del límite, pagos fallidos y suscripciones por vencer.

### Cliente final (rol nuevo, más adelante)

Un portal de solo lectura con la cronología del caso y un buzón para aportar documentos que el abogado solicita. Requiere decisiones legales sobre qué ve el cliente y qué constancia queda. No debe entrar sin el visto bueno del abogado del proyecto.

## 5. Cómo se muestran los datos

Lo que más se repite en los productos que se ven profesionales:

- **Una cifra grande con contexto**: el número, su comparación con el mes anterior y una línea de tendencia pequeña.
- **Estados vacíos que enseñan**: un ícono, una frase y una acción, en lugar de una tabla en blanco.
- **Una línea de tiempo única por caso**, que mezcle custodia, tareas, evidencias y notas, con filtros por tipo.
- **Atajos y paleta de comandos**: `Ctrl K` para saltar a cualquier pantalla o caso.
- **Tablas que se vuelven tarjetas** en el celular, que Aletheia ya hace.

## 6. Prioridad

Impacto y esfuerzo estimados sobre lo que ya existe.

| Prioridad | Qué | Por qué |
| --- | --- | --- |
| Primera | Paleta de comandos y búsqueda global | Se siente de inmediato y no cambia el modelo de datos |
| Primera | Carga por arrastre con progreso | Es el punto de contacto más usado y hoy usa el selector del navegador sin estilo |
| Primera | Tablero con almacenamiento, tareas vencidas y estados vacíos con acción | Responde a la sensación de panel vacío con datos que ya existen |
| Segunda | Calendario de plazos y suscripción iCal | Es lo más pedido por abogados |
| Segunda | Exportar auditoría a CSV | Ya existe el listado con filtros; falta la descarga |
| Segunda | Compartir una evidencia y certificado de integridad por archivo | Aprovecha el paquete y el sello que ya existen |
| Segunda | Notas del caso | Requiere una tabla nueva, pero es sencilla |
| Tercera | Políticas del despacho y segundo factor obligatorio | Exige cambios de seguridad y su propia revisión |
| Tercera | Plantillas de tareas | Se apoya en las notas y el calendario |
| Después | Portal del cliente | Decisiones legales previas |

## 7. Lo que no conviene copiar

- **Redacción automática de documentos** como la de Axon: Aletheia preserva, no interpreta. Una copia redactada se podría ofrecer, pero siempre como archivo aparte y marcado.
- **Facturación y control de horas** de Clio: es otro producto. Aletheia puede mostrar el plan y los pagos, nada más.
- **Prometer admisibilidad.** Ningún competidor serio la garantiza y la declaración de alcance de Aletheia ya lo dice. Se mantiene.

## 8. Fuentes

- [Axon Evidence](https://www.axon.com/au/products/axon-evidence), [descripción de la plataforma](https://slashdot.org/software/p/Axon-Evidence/) y [CivicDocs frente a eDCaseMAN](https://www.sourceforge.net/software/compare/CivicDocs-vs-eDCaseMAN).
- [Page Vault frente a Hanzo](https://www.page-vault.com/lp/hanzo-alternative-competitor) y [reseñas de Page Vault](https://www.g2.com/products/page-vault/reviews).
- [Funciones de Clio](https://clio.com/features/) y [gestión de asuntos de Clio](https://www.clio.com/features/matter-management/).
- [Portales de clientes de despachos](https://suitedash.com/best-client-portal-for-law-firms/).
- [Cómo certificar un chat de WhatsApp como prueba](https://www.asuntoslegales.com.co/consumidor/como-certificar-un-chat-de-whatsapp-para-que-funcione-como-prueba-en-un-proceso-judicial-3094511) y [claves para que un pantallazo sirva como prueba](https://www.asuntoslegales.com.co/consumidor/claves-para-que-un-pantallazo-de-whatsapp-sirva-como-prueba-4488006).
- [Masterclass de informática forense y evidencia digital para abogados](https://www.uexternado.edu.co/wp-content/uploads/2026/01/RELATORIA_Masterclass-Informatica-Forense-y-Evidencia-Digital-para-Abogados-27-NOV-25.pdf).
