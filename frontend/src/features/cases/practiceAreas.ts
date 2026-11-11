import type { CaseCreate } from "../../api/generated/types.gen.ts";

export type PracticeArea = NonNullable<CaseCreate["practice_area"]>;

export const PRACTICE_AREA_LABELS: Record<PracticeArea, string> = {
  civil: "Civil",
  commercial: "Comercial",
  family: "Familia",
  labor: "Laboral",
  criminal: "Penal",
  administrative: "Administrativa",
  constitutional: "Constitucional",
  other: "Otra",
};
