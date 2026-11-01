import { useEffect, useState } from "react";

// Franja de la pantalla que cuenta como "leyendo": del 20 % superior al 30 % inferior, para
// que el apartado activo cambie cuando su título pasa por la parte alta de la pantalla.
const READING_BAND = "-20% 0px -70% 0px";

/**
 * Id del apartado que se está leyendo, para resaltarlo en el índice. Sin IntersectionObserver
 * (navegadores muy viejos o pruebas) devuelve null y el índice se ve sin resaltado.
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // El primero en orden del documento gana cuando hay varios en la franja.
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: READING_BAND },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
