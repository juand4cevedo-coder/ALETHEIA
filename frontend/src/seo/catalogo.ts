// Precios públicos para los datos estructurados de la portada y de precios. Las páginas leen el
// catálogo de la API al abrirse, pero el HTML que leen los buscadores se arma al construir,
// sin la API: estos valores son la copia de ese catálogo (backend, tabla plans) y se
// actualizan en el mismo cambio que mueva un precio. Prueba es gratis; Corporativo se cotiza y
// no se publica.
export type PlanPublicado = {
  codigo: string;
  nombre: string;
  /** Pesos colombianos por mes. */
  mensual: number;
  /** Pesos colombianos por año, si el plan se vende por año. */
  anual: number | null;
  /** Pesos colombianos por mes de cada usuario adicional, si el plan lo permite. */
  usuarioAdicional: number | null;
};

export const PLANES_PUBLICADOS: readonly PlanPublicado[] = [
  {
    codigo: "trial",
    nombre: "Prueba",
    mensual: 0,
    anual: null,
    usuarioAdicional: null,
  },
  {
    codigo: "essential",
    nombre: "Esencial",
    mensual: 29_900,
    anual: 299_000,
    usuarioAdicional: null,
  },
  {
    codigo: "professional",
    nombre: "Profesional",
    mensual: 59_900,
    anual: 599_000,
    usuarioAdicional: 19_900,
  },
  {
    codigo: "firm",
    nombre: "Firma",
    mensual: 149_900,
    anual: 1_499_000,
    usuarioAdicional: 14_900,
  },
];
