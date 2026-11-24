# Aletheia 0.42.1

Lo que se corrigió y confirmó al probar la renovación automática contra el entorno de pruebas de Wompi (ver ADR-058). Sigue apagada.

- **Wompi no pide aprobación en cada cobro.** Se comprobó que un cobro con una fuente Nequi vinculada se resuelve solo en segundos, sin intervención de la persona. La etapa 2 funciona como se diseñó.
- **Contratos de Wompi aceptados de forma explícita.** El panel de renovación automática solo usaba en silencio los tokens de aceptación de Wompi; ahora muestra los dos contratos (términos de uso y tratamiento de datos) con su casilla y su enlace, y no deja vincular sin marcarlos. Cada token vale una sola vez: la pantalla los pide de nuevo si un intento falla o la página se recarga, y no reutiliza los de la caché. Si la página se recarga mientras se espera la aprobación en Nequi, pide aceptarlos otra vez para terminar.
- **El cobro se resuelve al momento.** Un cobro que nace pendiente se consulta unas veces en los siguientes segundos y, si ya se aprobó o rechazó, se aplica o se reintenta de inmediato en lugar de esperar al aviso de Wompi.
- `backend/scripts/probar_wompi_sandbox.py`: el script que hizo la prueba. Lee las llaves de pruebas de `backend/.env.wompi-sandbox` (Git la ignora), solo habla con el entorno de pruebas y se niega a correr con otras llaves.
- Sin migración.
