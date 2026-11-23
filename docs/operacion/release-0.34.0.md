# Aletheia 0.34.0

- **Entregar el despacho a otra persona.** En Miembros, la persona responsable del despacho tiene ahora el botón «Entregar el despacho» en cada miembro. Elige con qué rol sigue (abogado o administrador), confirma con su contraseña y el despacho queda a cargo de la otra persona: administra los datos del despacho, la facturación y el equipo. Siempre queda exactamente un responsable, y el traspaso queda en la auditoría del despacho (acción nueva `ownership_transferred`; migración 0051). Antes, quien era responsable no podía cambiar de rol ni cerrar su cuenta mientras hubiera más miembros, y no había forma de dejar el despacho a otra persona.
- Ruta nueva: `POST /api/v1/organization/ownership-transfer` (solo el responsable del despacho).
- El mensaje al cerrar la cuenta siendo responsable ahora dice dónde entregar el despacho.

**Límites conocidos**
- La contraseña es obligatoria: quien entró siempre con Google y nunca puso una contraseña debe crearla con «¿Olvidó su contraseña?» antes de entregar el despacho.
- Las pruebas de la base de datos de este cambio las ejecuta la CI.
