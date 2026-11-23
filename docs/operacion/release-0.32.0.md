# Aletheia 0.32.0

- **Pestaña Paquete con historial.** Antes solo se veía el último paquete pedido, y se perdía al recargar la página. Ahora lista los paquetes del caso, del más reciente al más antiguo: quién lo pidió y cuándo, su estado (en espera, preparándose, listo, enlace vencido o fallido), hasta cuándo está disponible el enlace y la huella SHA-256 de su manifiesto, con «Abrir descarga» y «Copiar enlace» en los que están listos. La lista se actualiza sola mientras uno se prepara y no deja pedir otro hasta que termine. La pestaña explica además qué incluye un paquete.
- Ruta nueva: `GET /api/v1/cases/{id}/exports`, con los mismos permisos que pedir un paquete (quien puede descargar originales). No hay migración.

Para verlo después de desplegar: abra un caso que ya tenga paquetes, pestaña «Paquete». Debe aparecer el historial con el estado de cada uno. Pida uno nuevo: debe aparecer arriba como «En espera» o «Preparándose» y pasar solo a «Listo».
