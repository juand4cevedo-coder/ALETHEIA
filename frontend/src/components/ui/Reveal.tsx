import type { ReactNode } from "react";

import styles from "./Reveal.module.css";

type RevealProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
};

// El contenido es visible desde el primer render: nunca arranca en opacidad 0 ni espera a un
// observador, porque un desplazamiento rápido dejaría la pantalla vacía. La entrada es solo una
// mejora que el navegador resuelve con una animación ligada al desplazamiento (ver el CSS); si no
// la soporta, o si la persona pidió menos movimiento, el contenido simplemente está ahí.
export function Reveal({ children, className, as: Tag = "div" }: RevealProps) {
  return (
    <Tag
      className={className ? `${styles.reveal} ${className}` : styles.reveal}
    >
      {children}
    </Tag>
  );
}
