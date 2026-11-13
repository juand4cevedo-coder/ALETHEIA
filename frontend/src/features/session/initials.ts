/** Iniciales para el sello de la cuenta: primera letra del nombre y del primer apellido. Sin
 * nombre devuelve vacío y el sello muestra el ícono de usuario. */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = [words[0], words.length > 1 ? words[1] : undefined]
    .map((word) => word?.[0] ?? "")
    .join("");
  return letters.toLocaleUpperCase("es-CO");
}
