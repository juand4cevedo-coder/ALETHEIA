# Rediseño público de Aletheia

13 de noviembre de 2026. Especificación de la identidad pública y sus efectos de movimiento.

## Referencia y decisiones

Se consultaron la portada, el menú de producto y el acceso de [Resend](https://resend.com/) como referencia visual. La implementación conserva recursos y comportamiento propios.

Esta iteración sustituye las decisiones de la revisión del 12 de noviembre respecto de la navegación, el objeto del hero, la banda de marca antes del footer y los archivos del símbolo.

- Navegación: Producto, Compañía, Equipos, Ayuda, Docs, Recursos y Precios. Seis desplegables comparten un panel con enlaces y una tarjeta ilustrada; admiten puntero, teclado, cierre exterior y Escape. En móvil son grupos desplegables dentro del diálogo existente.
- Portada: negro, iluminación tenue, título serif con degradado y una pieza geométrica de criptografía con anillos concéntricos, tramas y referencia a SHA-256. La escena usa SVG y CSS, se mueve de forma continua sin control de reanudación y respeta movimiento reducido. Tres líneas tenues detrás de la figura aportan profundidad.
- Recorrido: la tarjeta activa tiene un tramo verde que recorre todo el borde en un ciclo continuo; el resto mantiene un borde tenue.
- Tipografía: Inter e Instrument Serif, distribuidas con el proyecto. Instrument Serif aproxima el contraste editorial de Domaine; no se incorporan los archivos comerciales de fuente del sitio de referencia. El wordmark Aletheia usa Inter con peso y espaciado ajustados. No se presenta como el lettering exacto de Resend.
- Marca: los dos SVG de identidad conservan sus seis trazados. Se recorta únicamente el encuadre exterior para utilizarlos como símbolos. Favicon SVG y PNG de 32 px; icono Apple de 180 px. Los SVG claro y oscuro se descargan desde Marca.
- Vista previa social: fondo negro, titular de la portada, líneas de profundidad y un candado con referencia a SHA-256. Sustituye la imagen paisajística de la identidad anterior.
- Footer: cinco columnas con destinos existentes y un bloque de marca y contacto. Se retira la palabra gigante anterior. Se conservan las políticas, su versionado, la configuración de cookies y los enlaces del proveedor y de la autoridad de consumo.
- Acceso y registro: composición centrada, símbolo en recuadro, enlace de cambio de pantalla bajo el título y opciones Google/Microsoft. Se conserva el formulario real de correo y contraseña, las validaciones, la recuperación y la aceptación legal.
- Documentación: `/docs`, cinco guías con búsqueda insensible a acentos, navegación lateral, índice, pasos, enlaces a las funciones reales y recorrido anterior/siguiente. `/ayuda` sigue disponible.
- Blog: tres columnas en escritorio, cubiertas geométricas propias, filtro, búsqueda y cubierta en el artículo. El contenido existente se conserva.

## Google y Microsoft

Todavía no hay aplicaciones OAuth registradas. Los botones están deshabilitados y el producto explica que aún no están disponibles. No hay redirecciones ficticias ni una integración de identidad anunciada como funcional.

La activación sigue pendiente: registrar las aplicaciones de Google y Microsoft, acordar los dominios y las URI de retorno, almacenar los secretos fuera del repositorio, implementar el flujo de servidor y probar el recorrido completo de ambos proveedores. No basta con habilitar los botones de la interfaz. No se alteraron los cambios locales de identidad, MFA o sesiones del backend.

## Comprobación y revisión

La base anterior pasó 291 pruebas. Se añadieron comprobaciones de navegación y documentación y se adaptaron las de la portada al panel controlado. La revisión final incluye TypeScript, Vite, lint, pruebas y el presupuesto inicial de carga.

Tras el ajuste pasaron 295 pruebas de interfaz en 35 archivos, compilación, lint y formato. La entrada pública mide 115,56 kB de JavaScript y 6,88 kB de CSS comprimidos, bajo los límites de 120 y 30 kB. La escena actual elimina la dependencia de Three.js. Ruff, formato, mypy y 23 pruebas independientes de PostgreSQL del backend también pasaron; la suite de integración completa requiere la base temporal de CI.

La portada y las tarjetas se revisaron en el navegador local a 1260 y 390 px de ancho. En ese navegador la preferencia de movimiento reducido estaba activa: se comprobó la composición estática, no el movimiento efectivo de los ciclos. La medición de experiencia real sigue pendiente.

En la revisión siguiente, el centro de la escena se cambió por un candado y la referencia SHA-256 quedó visible bajo los anillos. Se aumentó el contraste de las tres líneas de profundidad. El borde verde de la tarjeta seleccionada ahora es un trazo SVG que recorre su perímetro mediante `stroke-dashoffset`, con ciclo infinito y estado fijo para movimiento reducido. La compilación conserva el presupuesto inicial (115,51 kB de JavaScript y 6,88 kB de CSS comprimidos); pasaron las 295 pruebas de interfaz, lint y formato. El navegador de revisión seguía configurado con movimiento reducido, así que el desplazamiento efectivo del trazo debe revisarse también con movimiento normal antes de publicar.

El servidor de desarrollo de revisión escucha únicamente en `127.0.0.1:5174`. Las pantallas que consultan datos reales necesitan la API local habitual en el puerto 8000. No se añadieron datos de precios ficticios para ocultar una desconexión del backend.
