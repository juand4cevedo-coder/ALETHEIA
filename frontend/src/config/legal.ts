// Las cuatro políticas legales se identifican por la fecha desde la que rigen, como día del
// calendario en Colombia (RF-003, RN-028 y RN-029). El registro guarda esta fecha junto con el
// momento en que cada persona aceptó los textos, así que se cambia aquí y en ningún otro lugar,
// y también en backend/app/core/legal.py. Un cambio que altere derechos u obligaciones lleva una
// fecha nueva. La página la muestra como fecha, nunca como un número de versión.
export const LEGAL_VERSION = "2026-11-02";
export const LEGAL_EFFECTIVE_DATE = LEGAL_VERSION;

// Responsable del tratamiento y proveedor del servicio. El Decreto 1074 de 2015
// (art. 2.2.2.25.3.1) exige publicar nombre, domicilio, dirección, correo y teléfono.
export const DATA_CONTROLLER = {
  name: "Juan Diego Acevedo Calderon",
  city: "Bello, Antioquia",
  address: "Avenida 40 # 62-56, Bello, Antioquia, Colombia",
  phone: "+57 311 782 0789",
  phoneHref: "tel:+573117820789",
} as const;
