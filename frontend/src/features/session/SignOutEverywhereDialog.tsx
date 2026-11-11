import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { DispositivosIcon } from "../../components/ui/icons.tsx";

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
      icon={<DispositivosIcon size={20} />}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            data-autofocus
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button size="sm" busy={busy} onClick={onConfirm}>
            {busy ? "Cerrando las sesiones" : "Cerrar todas las sesiones"}
          </Button>
        </>
      }
    >
      <p>
        Se cerrará la sesión en todos los equipos y navegadores donde haya
        ingresado, también en este.
      </p>
      <p>Úselo si perdió un equipo o cree que alguien más entró a su cuenta.</p>
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
