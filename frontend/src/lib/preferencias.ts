/** Si una consulta de medios se cumple. Donde no hay matchMedia (el prerender, algunas pruebas)
 * responde que no. */
export function coincide(consulta: string): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(consulta).matches
  );
}

/** Si la persona pidió menos movimiento en su sistema. */
export function movimientoReducido(): boolean {
  return coincide("(prefers-reduced-motion: reduce)");
}
