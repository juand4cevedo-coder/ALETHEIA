# Aletheia 0.47.0

**Esencial alcanza para el abogado y su asistente, los precios se leen sin JavaScript y el sitio explica con más detalle qué hace el producto.**

- **Planes.** Esencial incluye dos usuarios. Profesional pasa a cuatro, Firma a diez y la prueba a cuatro, lo mismo que Profesional (migración 0066). Los precios no cambian. Para los clientes actuales, el cambio solo suma cupos.
- **Precios en el HTML.** Las páginas públicas arrancan con una copia del catálogo que viaja con el sitio, y la API la reemplaza al llegar. Los buscadores ya leen las tarjetas con sus precios. Una prueba del backend compara esa copia con la API, así que un precio no puede quedar distinto en los dos lugares.
- **Página de precios.** Cada tarjeta lleva a la prueba y el registro recuerda qué plan miró la persona. Hay una calculadora que dice qué plan le sale más barato a un despacho según cuántas personas son, el teléfono va junto a las condiciones de compra y la pregunta sobre usuarios adicionales dice los cupos exactos de cada plan.
- **Portada.** Abre con la escena de la prueba que llega por WhatsApp y las preguntas que se le harán en audiencia. Lo que no hace incluye que ALETHEIA no vigila procesos en la Rama Judicial. Enlaza tres comparaciones y nombra a DigiCert y Sectigo, las autoridades que firman los sellos.
- **Comprobador.** /verificador calcula la huella de cualquier archivo, además de comparar con un manifiesto. Muestra los comandos de Windows, macOS y Linux y responde las preguntas más comunes.
- **Contenido.** Hay dos comparaciones nuevas: con la vigilancia de procesos y con una carpeta compartida. Tres artículos crecieron con ejemplos, comandos y la Ley 1123. La documentación suma guías para subir evidencia, exportar el paquete, revisar un sello con OpenSSL, compartir el caso con el cliente y activar la verificación en dos pasos. Nosotros dice la formación del fundador. La marca se escribe ALETHEIA en todo el producto.
- **SEO.** Cada página tiene su imagen para compartir, títulos de 60 caracteres o menos y descripciones que nunca cortan una frase. El fundador tiene su ficha Person. La prueba se declara por 14 días, el comprobador como herramienta gratuita y las guías como artículos técnicos. Cada página con preguntas publica su FAQPage. El mapa del sitio usa la fecha real de cada contenido.
- **Correos de la prueba.** Cada correo mira lo que el despacho ya hizo. Si no ha abierto un caso, el del día 3 se lo pide. Si ya subió evidencia, le propone exportar el paquete. Si ya invitó a su equipo, el del día 7 le muestra el portal del cliente. El aviso del día 11 cuenta lo que guardó.
- **Informe del paquete.** El PDF explica cómo comprobar el paquete sin ALETHEIA: el enlace al comprobador y el comando de OpenSSL para los sellos.

## Al desplegar

1. La migración 0066 corre sola. Solo cambia un plan si conserva el cupo anterior, así que no pisa un ajuste hecho desde la consola.
2. La prueba de humo revisa la imagen para compartir de /precios.

## Pendientes que no dependen del código

- Verificar Search Console y Bing por DNS y enviar el mapa del sitio.
- Crear perfiles reales (LinkedIn de la empresa, directorios como Capterra o Legal Technology Hub) para enlazarlos como sameAs.
- Conseguir los primeros despachos piloto y publicar su experiencia con autorización.
- Decidir un tiempo de respuesta habitual para publicarlo junto a los plazos legales.
