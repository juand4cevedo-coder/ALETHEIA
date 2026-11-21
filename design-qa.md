# Design QA — movimiento y carrusel público

## Evidencia

- Fuente visual: `https://nu.com.co/`, portada y carrusel “Haz más con la Cuenta de Ahorros Nu”.
- Implementación: `http://127.0.0.1:5173/`, bloque “Mucho más que ordenar expedientes”.
- Capturas: capturas del navegador integrado durante la sesión del 21 de noviembre de 2026; el navegador no expuso una ruta de archivo persistente.
- Vista de escritorio de la fuente: 1280 × 720 píxeles, viewport CSS 1280 × 720, DPR 1,25.
- Vista de escritorio de la implementación: 1130 × 710 píxeles visibles, viewport CSS aproximado 1147 × 726, DPR 1,25.
- Normalización: comparación por región funcional y proporciones, no por superposición de píxeles, porque el contenido y los activos deben seguir siendo propios de Aletheia.
- Estado de fuente: slide activo, indicadores visibles y reproducción automática disponible.
- Estado de implementación: slides 1 y 2, indicadores, progreso, pausa y selección manual.

## Comparación de vista completa

La implementación reproduce el patrón observado: sección editorial amplia, imagen o producto dominante, información contextual, acción principal, cinco indicadores y control de reproducción. Mantiene la navegación fija y el ritmo de secciones de la portada sin reutilizar activos ni textos de Nu.

## Comparación enfocada

- Tipografía: Inter sans serif, titulares compactos de alto contraste y texto de interfaz pequeño; jerarquía equivalente sin copiar la fuente propietaria de Nu.
- Ritmo y disposición: bloque de dos columnas, radio de 32 px, panel informativo y controles inferiores. La implementación agrega una métrica por slide para sostener la percepción de producto premium.
- Color: violeta Aletheia `#820AD1`, violeta profundo, blanco y fondo lavanda claro; contraste verificado por la prueba automatizada de accesibilidad.
- Imágenes: capturas reales del producto y fotografía real licenciada. No hay activos de Nu, marcadores ni dibujos aproximados.
- Contenido: cinco capacidades reales —control, casos, actividad, equipo e integridad— con rutas existentes y afirmaciones dentro del alcance actual.
- Interacción: avance cada 6,5 s, selección manual, pausa/reanudación, pausa durante foco o puntero y alternativa para movimiento reducido.

## Findings

- [P2] Comparación móvil de la nueva sección no normalizada.
  - Location: portada, carrusel de capacidades, breakpoint menor a 820 px.
  - Evidence: la capacidad de viewport del navegador no modificó las pestañas de Nu ni Aletheia; ambas siguieron reportando entre 1147 y 1280 px de ancho.
  - Impact: las reglas móviles existen y las pruebas funcionales pasan, pero falta evidencia visual comparable a 390 × 844 para este bloque nuevo.
  - Fix: repetir la captura en un navegador que permita emulación de viewport y comparar fuente e implementación a 390 × 844 antes de producción.

## Open Questions

- Ninguna sobre contenido o interacción. La única condición pendiente es la captura móvil normalizada.

## Implementation Checklist

- [x] Carrusel de cinco estados con contenido real.
- [x] Avance automático e indicadores de progreso.
- [x] Pausa, reanudación y selección manual.
- [x] Pausa durante interacción y soporte para movimiento reducido.
- [x] Prueba de accesibilidad y rutas.
- [x] Lint, TypeScript, build y presupuesto de recursos.
- [ ] Captura comparativa a 390 × 844.

## Comparison History

- Primera pasada: escritorio sin hallazgos P0/P1/P2 de composición o interacción. La falta de una captura móvil normalizada permanece como P2 y bloquea el cierre formal.

## Follow-up Polish

- P3: evaluar en la captura móvil si el texto de la acción debe ocupar todo el ancho o conservar una medida máxima de 280 px.

final result: blocked
