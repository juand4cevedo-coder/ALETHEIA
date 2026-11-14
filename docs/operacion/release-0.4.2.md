# Versión 0.4.2

13 de noviembre de 2026.

## Cambios

- La cuenta propietaria de la plataforma puede invitar integrantes a su propio despacho aunque el plan haya alcanzado el cupo incluido. La API comprueba el atributo único en la base; los demás despachos mantienen su límite y el envío de invitaciones conserva su control de frecuencia.
- La pantalla de miembros indica con claridad esta excepción y deja disponible la invitación.
- La portada usa un sello facetado con fragmentos ilustrativos de SHA-256, material oscuro, reflejos de color y rotación continua. El movimiento se detiene si la persona ha pedido movimiento reducido.
- Los paneles de cuentas, facturación, soporte y auditoría comparten una jerarquía visual renovada; el encabezado y la navegación del espacio de trabajo se actualizaron también.

## Verificación

- Compilar el frontend y ejecutar sus pruebas y comprobaciones de estilo.
- Ejecutar Ruff, mypy, las pruebas del contrato, las pruebas de invitaciones con PostgreSQL y la migración de ida y vuelta en CI.
- En producción, comprobar que la cuenta propietaria ve la invitación con un plan lleno y puede enviar una; verificar que otra cuenta sigue recibiendo el límite del plan.
- Revisar la portada en escritorio y móvil, con movimiento normal y reducido, y los cuatro paneles de plataforma con datos reales.

La etiqueta firmada `v0.4.2` inicia el flujo de publicación y el entorno `production` requiere su aprobación habitual.
