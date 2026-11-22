import { type ReactNode, useState } from "react";

import styles from "./FilterPanel.module.css";
import { useMediaQuery } from "./useMediaQuery.ts";

type FilterPanelProps = {
  children: ReactNode;
  /** Cuántos filtros están aplicados; se muestra junto al título cuando el panel está cerrado. */
  active?: number;
};

// Filtros de una lista. En pantallas anchas están siempre a la vista; en el celular se pliegan
// tras un botón «Filtros» para que el primer pantallazo muestre los resultados y no una pila de
// campos. Es un elemento details nativo: el teclado y los lectores de pantalla lo entienden sin
// código adicional.
export function FilterPanel({ children, active = 0 }: FilterPanelProps) {
  const wide = useMediaQuery("(min-width: 700px)");
  const [opened, setOpened] = useState(false);
  return (
    <details
      className={styles.panel}
      open={wide || opened}
      onToggle={(event) => {
        if (!wide) setOpened(event.currentTarget.open);
      }}
    >
      <summary className={styles.summary}>
        Filtros
        {active > 0 && <span className={styles.count}>{active}</span>}
      </summary>
      {children}
    </details>
  );
}
