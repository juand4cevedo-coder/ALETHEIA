// Saludo según la hora de Colombia, con el primer nombre de la persona: «Buenos días, Laura».
// Lo usan Inicio y el Resumen de la plataforma.
export function greeting(fullName: string, now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const salute =
    hour >= 5 && hour < 12
      ? "Buenos días"
      : hour >= 12 && hour < 19
        ? "Buenas tardes"
        : "Buenas noches";
  const firstName = fullName.trim().split(/\s+/)[0];
  return firstName ? `${salute}, ${firstName}` : salute;
}
