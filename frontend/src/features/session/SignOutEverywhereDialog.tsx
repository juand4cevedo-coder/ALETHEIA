import { MonitorSmartphone } from "lucide-react";

import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Notice } from "../../components/ui/Notice.tsx";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  failed: boolean;
};

// Confirmación antes de cerrar todas las sesiones (UI-020, HU-009): nombra la consecuencia y
// deja el foco en Cancelar, que es lo seguro. La usan el menú de la cuenta y Mi cuenta.
export function SignOutEverywhereDialog({
  open,
  onClose,
  onConfirm,
  busy,
  failed,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="¿Cerrar todas las sesiones?"
      icon={<MonitorSmartphone size={22} />}
      actions={
        <>
          <Button
            surface="dark"
            variant="secondary"
            size="sm"
            shape="pill"
            data-autofocus
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            variant="bright"
            size="sm"
            shape="pill"
            busy={busy}
            onClick={onConfirm}
          >
            {busy ? "Cerrando sesiones…" : "Cerrar todas"}
          </Button>
        </>
      }
    >
      <p>
        Cerraremos la sesión en todos los equipos y navegadores donde haya
        ingresado, también en este, y quien la tenga abierta quedará fuera en su
        siguiente acción. Úselo si perdió un equipo o cree que alguien más entró
        a su cuenta.
      </p>
      <p>Después tendrá que ingresar de nuevo con su contraseña.</p>
      {failed && (
        <Notice tone="error">
          No pudimos cerrar las sesiones. Revise su conexión e inténtelo de
          nuevo.
        </Notice>
      )}
    </Dialog>
  );
}
