import type { ReactNode } from "react";

import styles from "./AuthScreen.module.css";

type AuthScreenProps = {
  titleId: string;
  /** Formulario o mensaje principal, a la izquierda. */
  children: ReactNode;
  /** Panel de apoyo a la derecha; en celular va debajo del formulario. */
  aside?: ReactNode;
};

// Composición de todas las pantallas de acceso: el formulario a la izquierda, alineado como se
// lee, y a la derecha un solo panel que explica algo del producto con datos de la persona.
export function AuthScreen({ titleId, children, aside }: AuthScreenProps) {
  return (
    <section
      className={aside ? `${styles.screen} ${styles.split}` : styles.screen}
      aria-labelledby={titleId}
    >
      <div className={styles.primary}>{children}</div>
      {aside && <aside className={styles.aside}>{aside}</aside>}
    </section>
  );
}
