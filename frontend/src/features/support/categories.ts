import type { SupportTicketOut } from "../../api/generated";

export type TicketCategory = SupportTicketOut["category"];

// Tipos de solicitud y el plazo que la ley da para responder cada uno (services/support.py en el
// backend calcula la fecha exacta con los festivos de Colombia).
export const TICKET_CATEGORIES: readonly {
  value: TicketCategory;
  label: string;
  description: string;
}[] = [
  {
    value: "support",
    label: "Ayuda con el servicio",
    description:
      "Algo no funciona o no sabe cómo hacerlo. Respuesta en 15 días hábiles.",
  },
  {
    value: "data_query",
    label: "Consulta sobre mis datos personales",
    description:
      "Saber qué datos suyos tenemos y para qué. Respuesta en 10 días hábiles.",
  },
  {
    value: "data_claim",
    label: "Corregir, actualizar o suprimir mis datos",
    description:
      "Un reclamo sobre sus datos personales. Respuesta en 15 días hábiles.",
  },
  {
    value: "consumer",
    label: "Petición, queja o reclamo",
    description:
      "Sobre el servicio, un cobro o la garantía. Respuesta en 15 días hábiles.",
  },
  {
    value: "refund",
    label: "Reembolso",
    description:
      "Devolución de un pago. El dinero vuelve en máximo 15 días calendario.",
  },
];

export const TICKET_CATEGORY_LABELS = Object.fromEntries(
  TICKET_CATEGORIES.map((item) => [item.value, item.label]),
) as Record<TicketCategory, string>;

function todayInColombia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(new Date());
}

/** Si una solicitud abierta ya venció, vence en los próximos 3 días o tiene tiempo. */
export function dueState(dueOn: string): "overdue" | "soon" | "ok" {
  const today = todayInColombia();
  if (dueOn < today) return "overdue";
  const soon = new Date(`${today}T12:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 3);
  return dueOn <= soon.toISOString().slice(0, 10) ? "soon" : "ok";
}
