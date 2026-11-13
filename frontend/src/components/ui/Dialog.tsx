import { type ReactNode, useEffect, useId, useRef } from "react";

import styles from "./Dialog.module.css";

type DialogProps = {
  open: boolean;
  /** Se llama al cerrar con Escape, con un clic en el fondo o con close(). */
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Botones de la parte inferior; el que cancela va primero. */
  actions: ReactNode;
  /** Mientras la acción está en curso no se puede cerrar el diálogo. */
  busy?: boolean;
};

// Diálogo modal (CMP-UI-005) sobre el elemento dialog nativo con showModal: el navegador
// atrapa el foco, Escape lo cierra y el foco vuelve al botón que lo abrió. Un clic en el fondo
// también lo cierra, salvo mientras la acción está en curso.
export function Dialog({
  open,
  onClose,
  title,
  icon,
  children,
  actions,
  busy = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // El foco va al control marcado con data-autofocus; en una confirmación destructiva es
      // Cancelar. Sin marca, el navegador lo pone en el primer control.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) ref.current?.close();
      }}
    >
      <div className={styles.body}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {children}
        <div className={styles.actions}>{actions}</div>
      </div>
    </dialog>
  );
}
