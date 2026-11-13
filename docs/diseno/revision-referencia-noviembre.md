# Revisión de la referencia y alcance del rediseño

Fecha: 12 de noviembre de 2026. Antecedente de la revisión aprobada el 13 de noviembre; las decisiones vigentes constan en `redisenio-resend-2026-11-13.md`.

## Referencia

Se revisaron en navegador la portada de [Resend](https://resend.com/), su versión móvil, acceso, registro, precios, blog y buscador, marca, wallpapers, soporte, legal, seguridad, filosofía, base de conocimiento, estado, sobre nosotros, plantillas, webhooks y footer. La referencia anterior de paisaje deja de orientar esta propuesta.

| Elemento observado | Decisión para Aletheia | Motivo |
| --- | --- | --- |
| Negro, grises y luces suaves | Superficies oscuras compartidas entre sitio, acceso y aplicación | Mantener continuidad al ingresar; reservar color para estados |
| Domaine en titulares e Inter en interfaz | Instrument Serif e Inter, alojadas localmente | Aproximar el contraste editorial sin redistribuir una fuente comercial ajena |
| Hero lateral con objeto tridimensional | Referencia inicial de volumen y profundidad | La solución final usa una pieza propia de criptografía, descrita en la revisión del 13 de noviembre |
| Objeto sobre el título en móvil | Composición vertical centrada | Conservar presencia sin estrechar el texto |
| Navegación con desplegables | Producto, recursos y compañía con destinos existentes | Facilitar orientación sin anunciar funciones inexistentes |
| Marca de gran tamaño antes del footer | Aletheia en gris tenue y columnas de enlaces | Dar cierre visual sin competir con los contenidos |
| Formularios centrados | Campos etiquetados, errores junto al control y fondo discreto | Concentrar la atención en una sola tarea |
| Blog con categorías y búsqueda | Artículos propios sobre trabajo jurídico e integridad digital | Aportar contenido útil, con fechas reales y sin testimonios inventados |

## Producto y límites comprobados

El repositorio implementa cuentas, organizaciones, miembros, invitaciones, casos y sus permisos. La comparación SHA-256 de la portada se ejecuta en el navegador. Los ejemplos públicos deben identificar los datos de demostración y respetar el mismo modelo de permisos que la aplicación.

Carga de evidencia, sellado, exportación, webhooks, automatizaciones y pagos requieren cerrar sus flujos antes de anunciarlos como servicios disponibles. Las páginas de contenido no sustituyen esos servicios. No se publican porcentajes históricos de disponibilidad sin mediciones ni certificaciones de terceros sin acreditación.

## Acceso con proveedores

El titular confirmó que las aplicaciones de Google Cloud y Microsoft Entra todavía no están registradas. El acceso por contraseña se conserva. La activación social necesita clientes registrados, URI de retorno exactas, secretos fuera del repositorio y prueba completa por proveedor. No se vinculan cuentas automáticamente por coincidencia de correo. Se validan firma, emisor, destinatario, vencimiento, estado y nonce; el identificador estable procede del proveedor.

Fuentes: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [validación de Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).

## Información legal

La SIC indica que el comercio electrónico de consumo debe incluir un enlace visible a su autoridad; no exige reproducir su logo. Se conserva el enlace textual en el footer. La identificación y los canales obligatorios del responsable permanecen accesibles en las políticas. Suprimir repetición del footer no equivale a suprimir información exigida. Los textos contractuales conservan su control de versiones y aceptación.

Fuentes: [SIC, concepto sobre el enlace](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/titulo-obligacion-de-incluir-enlace-la-superindustria-en-plataformas-de-comercio-electronico), [Ley 1480, texto consolidado](https://normograma.mintic.gov.co/mintic/compilacion/docs/ley_1480_2011.htm), [políticas de tratamiento](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/politicas-de-tratamiento-de-datos-personales). GDPR requiere evaluar su ámbito territorial, no basta con que el sitio sea accesible desde Europa: [artículo 3](https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:32016R0679).

## Recursos y validación

Los logos y wallpapers de Resend no se redistribuyen como propios. Su kit indica no alterar sus archivos y la página de wallpapers no acredita una licencia comercial para incorporarlos a otro producto. Se crean recursos de Aletheia. El símbolo raster necesita un maestro vectorial y revisión marcaria antes del cierre definitivo de identidad.

La escena final usa SVG y CSS y respeta movimiento reducido. La revisión incluye teclado, errores, móvil, contraste, pruebas funcionales y presupuesto de carga. Las capturas de la aplicación se toman con datos locales de revisión, sin datos de clientes.

## Secuencia de entrega

1. Sistema visual, portada, navegación, acceso y paneles con funciones existentes.
2. Blog, ayuda y páginas de información coherentes con la implementación.
3. Integraciones y módulos pendientes con sus pruebas de autorización y negocio.
4. Aprobación visual; actualización de documentos formales respetando sus tablas y paginación.
5. Commits revisables, preparación de producción y despliegue autorizado. Las fechas del historial registran cuándo ocurrió el trabajo.

Fecha objetivo de cierre del producto: 25 de noviembre de 2026. Sustentación: 26 de noviembre de 2026.
