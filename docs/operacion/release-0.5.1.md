# Aletheia 0.5.1

- El cierre y el vencimiento de sesión eliminan los datos en caché del espacio de trabajo. Los formularios de acceso e invitación comparten este tratamiento al cambiar de cuenta.
- El verificador descarta resultados de cálculos anteriores y permite repetir la comprobación si el navegador interrumpe el cálculo. Se corrigió el contraste del texto bajo las vistas del producto en la portada.
- La descarga de originales y la resolución de enlaces de paquetes comprueban el estado de eliminación del caso. Al construir el paquete, el trabajador contrasta el último número de evento con el registrado por el caso.
- El cliente de sellado limita la lectura de respuestas y contacta únicamente los destinos configurados. La publicación comprueba la firma de la etiqueta antes de construir imágenes y despliega los digests obtenidos en esa compilación.
