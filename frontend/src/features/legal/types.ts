import type { ReactNode } from "react";

import type { LegalSlug } from "../../config/routes.ts";

/** Un apartado de una política: su título es un h2 y su id sirve de destino al índice. */
export type LegalSection = {
  id: string;
  title: string;
  /**
   * Normas en que se apoya el apartado, tal como se citan al margen ("Ley 1581 de 2012,
   * art. 8"). Solo se cita lo verificado en el texto vigente; un apartado puramente
   * contractual no lleva ninguna.
   */
  basis?: readonly string[];
  body: ReactNode;
};

/** Una idea clave del resumen inicial: no reemplaza el texto completo. */
export type LegalKeyPoint = {
  title: string;
  text: string;
};

/** Una política completa, tal como la muestra la página legal (UI-003). */
export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  /** Descripción para buscadores y redes. */
  description: string;
  /** Las tres o cuatro ideas que más le importan a quien la lee, en lenguaje sencillo. */
  keyPoints: readonly LegalKeyPoint[];
  sections: readonly LegalSection[];
};
