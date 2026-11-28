import type { ReactNode } from "react";

import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  /** Texto del botón que confirma, en verbo: «Revocar el enlace». */
  confirmLabel: string;
  /** Una acción que borra o quita algo va en rojo. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Confirmación antes de una acción que no se deshace, con el mismo diálogo del resto del
// producto en lugar del cuadro gris del navegador (window.confirm): respeta el tema, se lee con
// el lector de pantalla y deja claro qué pasa al aceptar.
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      busy={busy}
      title={title}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            size="sm"
            busy={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
