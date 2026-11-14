# Identidad y sistema de diseño

| Campo | Contenido |
| --- | --- |
| Estado | Identidad vigente desde el 13/11/2026, con ajustes de escena y borde documentados |
| Reemplaza | Propuestas anteriores de esta rama. Los ADR se conservan como registro histórico |
| Referencia | Resend, revisado en escritorio y móvil, con inspección de estilos computados |
| Decisión | Negro, contraste editorial, superficies con luz discreta y continuidad entre sitio y aplicación |

## 1. Principios

1. **Fidelidad en los detalles.** La referencia orienta radios, tonalidades, transiciones, composición y ritmo. Los recursos, el contenido y los ejemplos corresponden a Aletheia.
2. **Un mismo producto.** El acceso y los paneles comparten los colores, controles y tipografía de interfaz de la portada.
3. **Presentar y trabajar son tareas distintas.** Los titulares de presentación pueden centrarse; formularios, listas y tablas conservan la alineación que facilita leer y comparar.
4. **El movimiento acompaña.** No bloquea tareas ni oculta información. La escena se mueve de forma continua y se respeta movimiento reducido.
5. **Decir lo que existe.** No inventar testimonios, certificaciones, disponibilidad histórica ni funciones operativas.

## 2. Logo

El símbolo es una A compacta, con abertura interior y un corte en el travesaño. La abertura representa hacer visible; su silueta conserva presencia a tamaños pequeños. El nombre se escribe Aletheia con una composición tipográfica sans serif.

Aletheia es el término griego para verdad. La interpretación filosófica como desocultamiento inspira la abertura, sin presentarse como una etimología indiscutida: [Stanford Encyclopedia of Philosophy, sección 2.7](https://plato.stanford.edu/entries/heidegger/#Trut).

| Uso | Recurso | Criterio |
| --- | --- | --- |
| Navegación e interfaz | frontend/src/assets/simbolo.svg | Blanco sobre fondo oscuro |
| Favicon | frontend/public/favicon.png | 32 px |
| Dispositivos | frontend/public/apple-touch-icon.png | 180 px |
| Correos | frontend/public/email/logo-claro.png | PNG servido desde el mismo dominio |

El símbolo de interfaz y los archivos de descarga de marca son vectoriales; los iconos y el correo utilizan derivados PNG. Falta una revisión marcaria antes de declarar terminada la identidad. No se reutiliza ni altera el logotipo de Resend.

## 3. Color

Los valores compartidos viven en frontend/src/styles/tokens.css.

| Token | Valor | Uso |
| --- | --- | --- |
| --bg | #000000 | Fondo |
| --surface-1 | #0E0F11 | Paneles y campos |
| --surface-2 | #1A1B1E | Superficies seleccionadas |
| --brand-dark | #08090B | Superficie de marca |
| --line | #252629 | Separación interna |
| --line-control | #686B70 | Contorno reconocible de controles |
| --text | #F0F0F0 | Texto principal |
| --text-2 | #A1A4A5 | Texto secundario |
| --text-3 | #999DA3 | Apoyo |
| --accent | #F0F0F0 | Enlaces y foco |
| --accent-strong | #FFFFFF | Énfasis |
| --on-accent | #08090B | Texto sobre superficies claras |
| --ok | #63D4A1 | Confirmación con texto |
| --warn | #E8BA75 | Atención |
| --err | #FF9999 | Error |

El borde de presentación usa rgba(214, 235, 253, 0.19). Los campos mantienen un contorno más contrastado por accesibilidad. El recorrido de producto usa verde #22C55E para señalar su pestaña activa; no indica que una evidencia esté verificada.

## 4. Tipografía

Instrument Serif para titulares editoriales; Inter Variable para interfaz y lectura; Geist Mono para huellas. Son archivos WOFF2 locales. Domaine, utilizada por la referencia, requiere licencia comercial propia y no se extrae de ese sitio.

| Rol | Tamaño / interlineado | Peso | Espaciado |
| --- | --- | --- | --- |
| Hero | 72–104 px / 0,98; móvil 64 px | 400 | -0,015 em |
| Página editorial | Hasta 80 px / 1,05 | 400 | -0,02 em |
| Sección | 48 / 52; móvil 36 / 40 | 400 | -0,025 em |
| Pantalla de trabajo | 28 / 34 | 500 | -0,02 em |
| Formulario de acceso | 28 / 1,25 | 500 | -0,02 em |
| Cuerpo | 15 / 24 | 400 | Normal |
| Interfaz | 14 / 20 | 400–650 | Normal |
| Apoyo | 13 / 18 | 400 | Normal |
| Mono | 13 / 20 | 400 | Normal |

## 5. Espacio, forma y profundidad

- Escala de 4 px. Marco público de hasta 1280 px; contenido de trabajo acotado.
- Secciones de presentación con 96 px verticales, 64 px en móvil.
- Separadores superiores con curvatura de 24 px y borde translúcido, sin cortar visualmente toda la pantalla con una línea rígida.
- Tarjetas principales de 24 px, pestañas de 16 px, controles con radios acordes a su función.
- Luces superiores concentradas, degradados hacia negro y brillo fino sobre el borde de tarjetas.
- Nombre grande y opaco antes del footer, con la misma composición de marca y color #0D0D0D.

## 6. Íconos

Phosphor con importaciones individuales. Tamaños de 14–24 px según el control; bloques de presentación pueden enmarcarlos en una superficie de 40 px. Los íconos decorativos no repiten su nombre al lector de pantalla.

## 7. Componentes

- **Principal:** degradado 104 grados desde blanco al 5 % hacia blanco cálido al 10 %, borde de 2 px al 5 %, radio de 16 px. Al pasar el cursor aclara el fondo y oscurece el texto.
- **Campos:** etiqueta permanente, ayuda y error asociados, altura de 48 px, foco visible y autocompletado consistente.
- **Navegación:** desplegables nativos, cierre con Escape y al navegar, diálogo móvil con foco contenido.
- **Etiqueta multicolor:** borde cian, ámbar y violeta translúcido; interior #0B0E14; recorrido de 30 segundos.
- **Pestaña activa:** luz verde que recorre el borde en 6 segundos. Flechas, Inicio y Fin permiten cambiar la vista con teclado.
- **Escena:** bloque documental tridimensional que se despliega y reúne, realizado con geometría propia.
- **Acceso:** formulario centrado y fondo monocromático original; sin botones de proveedores inactivos.
- **Legal:** documentos accesibles desde el footer, identidad del proveedor en sus políticas y enlace visible a la SIC. Se conserva la versión contractual vigente.

## 8. Rendimiento

| Métrica | Meta o criterio |
| --- | --- |
| JavaScript inicial | Menos de 120 KB gzip, validado por el build |
| CSS inicial | Menos de 30 KB gzip, validado por el build |
| Escena | Ilustración SVG y CSS sin WebGL ni dependencia de renderizado 3D |
| Movimiento | Animación continua mientras la página está visible; se respeta la preferencia de movimiento reducido |
| Imágenes | WebP, dimensiones declaradas y carga diferida de capturas |
| Fuentes | WOFF2 local, subconjunto latino y sustitución durante la carga |
| LCP en móvil 4G | Meta menor de 1,8 s; requiere medición real, no se deduce del tamaño del build |
| CLS | Meta menor de 0,05; requiere medición de navegación |

La escena es opcional para comprender y utilizar la página. El comparador local limita archivos a 32 MB. Los recursos de las propuestas descartadas no se distribuyen con el sitio.

## 9. Redacción

Español de Colombia, tratamiento de usted y frases concretas. Las acciones dicen qué hacen; los errores explican cómo seguir. Los artículos tienen fechas reales. Las capturas identifican sus datos de demostración. No se prometen resultados probatorios ni posiciones garantizadas en buscadores.

## 10. Alcance de la aplicación

Esta revisión incluye portada, navegación, acceso, paneles existentes, precios, legales, blog, ayuda, filosofía, sobre Aletheia, marca, seguridad, soporte, empresa y consulta de estado. La consulta de salud verifica la API y su conexión con la base de datos; no equivale a supervisión histórica de todos los componentes.

Google y Microsoft requieren aplicaciones todavía no registradas. La implementación de carga de evidencia, sellado, descarga de originales, exportación, pagos, webhooks y automatizaciones se valida por separado. Esta revisión visual no acredita que esos recorridos estén completos.

## 11. Estructura de la landing

| Sección | Pregunta que responde |
| --- | --- |
| Hero | ¿Qué aporta Aletheia? Titular y acciones junto a la escena documental |
| Recorrido | ¿Cómo se ve por dentro? Capturas reales de resumen, casos y actividad |
| Cómo funciona | ¿Cómo empiezo? Equipo, caso y responsabilidades |
| Seguridad | ¿Quién accede? Controles y fundamentos desplegables |
| Alcance | ¿Qué hace y qué no determina? |
| Comprobador | ¿Coincide el contenido con una referencia? |
| Precios | ¿Qué contempla cada plan del catálogo? |
| Preguntas | ¿Qué necesito saber antes de empezar? |
| Cierre y footer | Acción principal, marca y acceso organizado a los recursos |

## 12. Documentos que se actualizan

La revisión detallada de la referencia y sus fuentes está en revision-referencia-noviembre.md. Estas decisiones se trasladan a Diseño UX/UI, Arquitectura y Manual de Usuario conservando su orden, tablas y paginación. Los documentos formales distinguen las funciones implementadas de las pendientes.

Hito de cierre: 25 de noviembre de 2026. Sustentación: 26 de noviembre de 2026. El historial conserva las fechas reales del trabajo.
