import { type RefObject, useEffect } from "react";

// Luz que sigue al puntero sobre las tarjetas marcadas con data-spotlight dentro del
// contenedor. Escribe la posición en variables CSS (--spot-x y --spot-y) con CSSOM, que la
// política de seguridad permite; el dibujo lo hace el CSS de cada tarjeta. Solo se activa
// con un puntero fino, así que en pantallas táctiles no hace nada.
export function useSpotlight(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !window.matchMedia?.("(pointer: fine)").matches) return;

    function handleMove(event: PointerEvent) {
      const card = (event.target as Element).closest<HTMLElement>(
        "[data-spotlight]",
      );
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
      card.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
    }

    container.addEventListener("pointermove", handleMove, { passive: true });
    return () => container.removeEventListener("pointermove", handleMove);
  }, [containerRef]);
}
