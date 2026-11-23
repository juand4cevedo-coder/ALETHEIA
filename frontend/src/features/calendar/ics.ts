// Archivo .ics (RFC 5545) con los plazos del mes, para llevarlos al calendario personal. Se
// arma en el navegador con lo que la persona ya está viendo: no hay una dirección pública que
// otra persona pudiera abrir.

export type IcsTask = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  case_title: string;
  status: string;
  priority: string;
};

const PRIORITY: Record<string, string> = {
  urgent: "1",
  high: "3",
  normal: "5",
  low: "9",
};

const CRLF = "\r\n";

/** Escapa los caracteres que tienen significado dentro de un valor de texto. */
function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Las líneas no pasan de 75 bytes: la continuación empieza con un espacio. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join(CRLF + " ");
}

function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** El calendario completo. Devuelve null si ningún plazo tiene fecha. */
export function buildIcs(
  tasks: readonly IcsTask[],
  now: Date = new Date(),
): string | null {
  const dated = tasks.filter(
    (task) => task.due_at !== null && task.status !== "canceled",
  );
  if (dated.length === 0) return null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ALETHEIA//Plazos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Plazos de Aletheia",
  ];
  for (const task of dated) {
    const start = new Date(task.due_at!);
    // Un plazo es un instante, no una franja: el evento dura quince minutos para que se vea.
    const end = new Date(start.getTime() + 15 * 60 * 1000);
    const description = [
      task.description,
      `Caso: ${task.case_title}`,
      task.status === "completed" ? "Estado: completada." : null,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${task.id}@aletheia.sbs`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(start)}`,
      `DTEND:${utcStamp(end)}`,
      `SUMMARY:${escapeText(task.title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      `PRIORITY:${PRIORITY[task.priority] ?? "5"}`,
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(task.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join(CRLF) + CRLF;
}
