import type { LegalSlug } from "../../config/routes.ts";
import { cookiePolicy } from "./cookies.tsx";
import { privacyPolicy } from "./privacy.tsx";
import { refundPolicy } from "./refunds.tsx";
import { termsOfService } from "./terms.tsx";
import type { LegalDocument } from "./types.ts";

// Las cuatro políticas de RF-003, una por cada slug de LEGAL_PAGES. El tipo obliga a que no
// falte ninguna: si se agrega una página legal a la configuración, aquí hay que darle su texto.
export const LEGAL_DOCUMENTS: Readonly<Record<LegalSlug, LegalDocument>> = {
  privacidad: privacyPolicy,
  terminos: termsOfService,
  cookies: cookiePolicy,
  reembolsos: refundPolicy,
};

/** Política que corresponde al segmento de la dirección, o undefined si no existe. */
export function findLegalDocument(
  slug: string | undefined,
): LegalDocument | undefined {
  if (slug === undefined || !Object.hasOwn(LEGAL_DOCUMENTS, slug)) {
    return undefined;
  }
  return LEGAL_DOCUMENTS[slug as LegalSlug];
}
