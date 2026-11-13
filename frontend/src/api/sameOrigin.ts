// Encabezado propio de la interfaz: la API rechaza con 403 cualquier petición que cambie algo
// sin él (protección contra CSRF, ADR-028).
export const SAME_ORIGIN_HEADER = "X-Aletheia-Request";
