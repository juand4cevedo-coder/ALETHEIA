// Cuándo llegó un aviso, en palabras: «Hace 5 minutos», «Ayer» y, pasada una semana, la fecha
// corta en hora de Colombia.

const relative = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" });

export function timeAgo(iso: string, now = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "Hace un momento";
  if (abs < 3600)
    return capitalize(relative.format(Math.round(seconds / 60), "minute"));
  if (abs < 86_400)
    return capitalize(relative.format(Math.round(seconds / 3600), "hour"));
  if (abs < 7 * 86_400)
    return capitalize(relative.format(Math.round(seconds / 86_400), "day"));
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
