import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import styles from "./Reveal.module.css";

/* Revela su contenido una sola vez, al entrar en pantalla.
 *
 * El contenido nace VISIBLE (data-visible="true") y solo se oculta dentro del callback del
 * observador, cuando la primera notificación confirma que está bajo el pliegue. Así el
 * invariante se cumple por construcción: lo único que se oculta es lo que ya demostró que el
 * observador funciona. Si el observador no existe, lanza una excepción o nunca notifica
 * (navegador sin soporte, rastreador, entorno de pruebas), el contenido jamás se ocultó.
 * Nunca debe invertirse este orden.
 *
 * Lo que ya está en pantalla al cargar no recibe animación de entrada: no "entra" en ninguna
 * parte.
 *
 * El atributo se cambia sobre el elemento y no con estado de React porque ocultar cuando el
 * observador ya notificó es más seguro que nacer oculto, y porque React lo escribe una sola vez
 * y nunca lo pisa. */
export function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  /** Retraso en milisegundos, para escalonar elementos hermanos. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    let observer: IntersectionObserver | undefined;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          const entering = entries.some((entry) => entry.isIntersecting);
          if (entering) {
            // Ya a la vista, o recién cruzado: queda visible y no se vuelve a observar.
            element.dataset.visible = "true";
            observer?.disconnect();
          } else {
            // Primera notificación fuera de pantalla: está bajo el pliegue.
            element.dataset.visible = "false";
          }
        },
        { threshold: 0.08 },
      );
      observer.observe(element);
    } catch {
      observer?.disconnect();
      return;
    }
    return () => {
      observer?.disconnect();
      // Un desmontaje entre ocultar y revelar no deja el elemento oculto.
      element.dataset.visible = "true";
    };
  }, []);

  return (
    <div
      ref={ref}
      className={styles.reveal}
      data-visible="true"
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
