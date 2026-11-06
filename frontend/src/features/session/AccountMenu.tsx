import { ChevronDown, KeyRound, LogOut, MonitorSmartphone } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import type { Me } from "../../api/generated";
import { Button } from "../../components/ui/Button.tsx";
import { ROUTES } from "../../config/routes.ts";
import { ROLE_LABELS } from "../workspace/roles.ts";
import styles from "./AccountMenu.module.css";
import { initialsOf } from "./initials.ts";
import { useSignOut } from "./useSignOut.ts";

// Menú de la cuenta en el encabezado del espacio de trabajo (HU-009). Es un botón que despliega
// un panel, no un menú de aplicación: se recorre con Tab, se cierra con Escape o con un clic
// fuera y devuelve el foco al botón. Cerrar todas las sesiones pide confirmación, porque saca
// también a este dispositivo.
export function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const dialogTitleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const session = useSignOut();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function confirmEverywhere() {
    setOpen(false);
    dialogRef.current?.showModal();
  }

  const role = me.organization ? ROLE_LABELS[me.organization.role] : null;

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.seal} aria-hidden="true">
          {initialsOf(me.full_name)}
        </span>
        <span className={styles.who}>
          <span className={styles.person}>{me.full_name}</span>
          {me.organization && (
            <span className={styles.organization}>
              {me.organization.name} · {role}
            </span>
          )}
        </span>
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
        <span className="visually-hidden">Opciones de la cuenta</span>
      </button>

      <div id={panelId} className={styles.panel} hidden={!open}>
        <div className={styles.account}>
          <p className={styles.panelName}>{me.full_name}</p>
          <p className={styles.panelEmail} translate="no">
            {me.email}
          </p>
        </div>
        <ul className={styles.actions}>
          <li>
            <Link
              to={ROUTES.security}
              className={styles.action}
              onClick={() => setOpen(false)}
            >
              <KeyRound size={18} aria-hidden="true" />
              <span className={styles.actionText}>
                <span className={styles.actionLabel}>Seguridad</span>
                <span className={styles.actionHint}>Cambiar la contraseña</span>
              </span>
            </Link>
          </li>
          <li>
            <button
              type="button"
              className={styles.action}
              onClick={session.signOut}
              disabled={session.pending !== null}
              aria-busy={session.pending === "device" || undefined}
            >
              <LogOut size={18} aria-hidden="true" />
              <span className={styles.actionText}>
                <span className={styles.actionLabel}>
                  {session.pending === "device"
                    ? "Cerrando sesión…"
                    : "Cerrar sesión"}
                </span>
                <span className={styles.actionHint}>
                  Solo en este dispositivo
                </span>
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={styles.action}
              onClick={confirmEverywhere}
              disabled={session.pending !== null}
            >
              <MonitorSmartphone size={18} aria-hidden="true" />
              <span className={styles.actionText}>
                <span className={styles.actionLabel}>
                  Cerrar todas las sesiones
                </span>
                <span className={styles.actionHint}>
                  En todos sus dispositivos, también este
                </span>
              </span>
            </button>
          </li>
        </ul>
        {session.failed && (
          <p className={styles.failure} role="alert">
            No pudimos cerrar la sesión. Revise su conexión e inténtelo de
            nuevo.
          </p>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={dialogTitleId}
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          // Un clic en el fondo oscuro, fuera del cuadro, lo cierra sin hacer nada.
          if (
            event.target === event.currentTarget &&
            session.pending !== "everywhere"
          ) {
            dialogRef.current?.close();
          }
        }}
      >
        <div className={styles.dialogBody}>
          <span className={styles.dialogIcon} aria-hidden="true">
            <MonitorSmartphone size={22} />
          </span>
          <h2 id={dialogTitleId} className={styles.dialogTitle}>
            ¿Cerrar todas las sesiones?
          </h2>
          <p>
            Se cierra la sesión en todos los equipos y navegadores donde haya
            ingresado, también en este, y quien la tenga abierta queda fuera en
            su siguiente acción. Úselo si perdió un equipo o cree que alguien
            más entró a su cuenta.
          </p>
          <p className={styles.dialogNote}>
            Después tendrá que ingresar de nuevo con su contraseña.
          </p>
          {session.failed && (
            <p className={styles.failure} role="alert">
              No pudimos cerrar las sesiones. Revise su conexión e inténtelo de
              nuevo.
            </p>
          )}
          <div className={styles.dialogActions}>
            <Button
              surface="dark"
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={() => dialogRef.current?.close()}
              disabled={session.pending === "everywhere"}
            >
              Cancelar
            </Button>
            <Button
              variant="bright"
              size="sm"
              shape="pill"
              busy={session.pending === "everywhere"}
              onClick={session.signOutEverywhere}
            >
              {session.pending === "everywhere"
                ? "Cerrando sesiones…"
                : "Cerrar todas"}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
