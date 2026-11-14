# Preparación de la versión 0.4.1

13 de noviembre de 2026. Corrección visual de la versión 0.4.0.

## Cambios

- La portada muestra el recorrido conceptual de un archivo hacia su huella SHA-256. Los caracteres de la ilustración son un fragmento ilustrativo, no el resultado de calcular una huella.
- En el recorrido del producto, el borde de la tarjeta activa permanece neutro y un tramo luminoso recorre su perímetro. Con la preferencia de movimiento reducido no se muestra el tramo.
- El menú de la cuenta con el atributo único `is_platform_admin` muestra el cargo “Propietario de Aletheia”.

## Estado de acceso

La cuenta personal indicada por la persona propietaria quedó activa, verificada y con `is_platform_admin = true` en producción. La asignación se realizó con el comando de mantenimiento de la versión 0.4.0 y se comprobó con una lectura de la base. El cargo permite gestionar el estado de las cuentas y no concede acceso a expedientes de otros despachos.

Los roles de despacho `owner`, `admin`, `lawyer` y `assistant` ya tienen permisos aplicados a las funciones existentes. Los paneles de inicio, casos, miembros y cuenta están disponibles según esos permisos. La consola de plataforma dispone de gestión de cuentas; facturación, soporte y auditoría transversal siguen pendientes de implementación.

## Publicación

La etiqueta firmada `v0.4.1` sobre `main` inicia el flujo de publicación. El entorno `production` requiere aprobación manual. Después del despliegue, revisar la portada y el recorrido con y sin movimiento reducido, iniciar sesión con la cuenta propietaria y comprobar el acceso a `/app/plataforma`.
