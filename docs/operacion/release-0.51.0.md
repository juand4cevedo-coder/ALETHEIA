# Aletheia 0.51.0

**La plataforma cierra despachos completos y distingue cuentas independientes de firmas; la documentación queda al día con la identidad actual.**

- **Cerrar un despacho (ADR-061).** Desde Plataforma > Despachos, escribiendo el nombre exacto del despacho, se cierran y anonimizan las cuentas de todas sus personas, se cancela la suscripción y se revocan las invitaciones y los portales de sus clientes. Los casos y sus pruebas se conservan en solo lectura hasta cumplir su plazo de conservación. Queda en la auditoría.
- **Independiente o firma.** Cada despacho guarda el tipo que se eligió al registrarse. La lista de la plataforma lo muestra, lo filtra y lo exporta. Los despachos existentes se clasificaron como independientes si tenían una sola persona y llevaban su nombre.
- **Documentación.** La identidad y el sistema de diseño describen la marca vigente: el emblema como logo, la paleta lavanda y crema, Newsreader en los títulos, el movimiento y los componentes actuales. El índice de ADR suma del 058 al 061 y ADR-049 queda reemplazado por ADR-060. README y producción explican las fotos, las fuentes y cómo renovar la caché de imágenes.

## Al desplegar

1. Corre la migración 0067: agrega `organizations.kind`, la función `delete_organization_as_platform` y la acción de auditoría `organization_deleted_by_platform`.
2. Pendiente conocido: los casos de un despacho cerrado no se borran solos al vencer su plazo; el primero vencería en 2036 (ADR-061).
