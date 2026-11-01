// Versión vigente de las cuatro políticas legales (RF-003, RN-029). El registro guardará esta
// versión junto con la fecha en que cada persona la aceptó, así que se cambia aquí y en ningún
// otro lugar. Un cambio de texto que altere derechos u obligaciones sube la versión.
export const LEGAL_VERSION = "1.0";

// Fecha desde la que rige esa versión, como día del calendario en Colombia (RN-028).
export const LEGAL_EFFECTIVE_DATE = "2026-11-02";

// Responsable del tratamiento y proveedor del servicio. El Decreto 1074 de 2015
// (art. 2.2.2.25.3.1) exige publicar nombre, domicilio, dirección, correo y teléfono.
export const DATA_CONTROLLER = {
  name: "Juan Diego Acevedo Calderon",
  city: "Bello, Antioquia",
  address: "Avenida 40 # 62-56, Bello, Antioquia, Colombia",
  phone: "+57 311 782 0789",
  phoneHref: "tel:+573117820789",
} as const;
