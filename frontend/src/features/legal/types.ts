import type { ReactNode } from "react";

import type { LegalSlug } from "../../config/routes.ts";

/** Un apartado de una política: su título es un h2 y su id sirve de destino al índice. */
export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

/** Una política completa, tal como la muestra la página legal (UI-003). */
export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  /** Descripción para buscadores y redes. */
  description: string;
  /** Resumen en lenguaje sencillo; no reemplaza el texto completo. */
  summary: string;
  sections: readonly LegalSection[];
};
