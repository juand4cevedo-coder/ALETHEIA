import { type ReactNode, useEffect, useRef, useState } from "react";

import styles from "./Reveal.module.css";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Retraso escalonado, en pasos de 90 ms, para elementos que aparecen en grupo. */
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
  as?: "div" | "li";
};

// Cuánto del elemento debe entrar en pantalla antes de mostrarlo.
const VISIBLE_RATIO = 0.15;

// Muestra su contenido con una entrada suave la primera vez que llega a la pantalla. Sin
// IntersectionObserver (navegadores muy viejos o pruebas) el contenido se ve desde el inicio.
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const element = ref.current;
    if (visible || !element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: VISIBLE_RATIO },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      className={className ? `${styles.reveal} ${className}` : styles.reveal}
      data-state={visible ? "visible" : "pending"}
      data-delay={delay}
    >
      {children}
    </Tag>
  );
}
