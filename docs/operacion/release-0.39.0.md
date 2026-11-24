# Aletheia 0.39.0

Versión de documentación y preparación; no cambia el comportamiento de la plataforma.

- **Pruebas manuales con sesión real** (`docs/operacion/pruebas-manuales.md`): recorridos paso a paso del equipo, el archivo, el portal del cliente, la cadena de custodia, el pago y el comprobante, y la plataforma, con lo que debe verse en cada paso.
- **ADR-058, renovación automática** (propuesto): los valores por omisión para vincular Nequi y cobrar solo: consentimiento registrado, aviso siete días antes, reintentos a los 3 y 6 días, cancelación inmediata y comprobante por cada cobro. Se construye después de comprobar un pago real por el Checkout Web, y se publica apagado.
- **Respaldos:** el disco anterior sin cifrar ya no lleva la etiqueta `respaldo=diario` (24/11/2026), así que dejó de generar copias sin cifrar. El disco nuevo cifrado sigue con la etiqueta y su primera copia cifrada se completó.
