// Textos y formatos que comparten las pantallas de la consola de la plataforma.
import { formatColombiaDate } from "../../features/cases/dates.ts";

/** Un día del calendario (AAAA-MM-DD) escrito como se lee en Colombia, sin correrlo de zona. */
export function formatDay(day: string): string {
  return formatColombiaDate(`${day}T12:00:00-05:00`);
}

export function money(value: number | null): string {
  return value === null
    ? "Por cotización"
    : `$${value.toLocaleString("es-CO")}`;
}

export const SUBSCRIPTION_LABELS: Record<string, string> = {
  trial: "Prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  expired: "Vencida",
};

export const ACCESS_LABELS: Record<string, string> = {
  trial: "Prueba",
  courtesy: "Asignado por la plataforma",
  payment: "Pagado",
  legacy: "Pagado antes de la pasarela",
};

export const ORGANIZATION_LABELS: Record<string, string> = {
  active: "Activo",
  read_only: "Solo lectura",
  suspended: "Suspendido",
  closed: "Cerrado",
};
