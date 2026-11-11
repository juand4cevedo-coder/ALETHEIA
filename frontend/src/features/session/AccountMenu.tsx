import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import type { Me } from "../../api/generated";
import { ROUTES } from "../../config/routes.ts";
import { ROLE_LABELS } from "../workspace/roles.ts";
import styles from "./AccountMenu.module.css";
import { initialsOf } from "./initials.ts";
import { SignOutEverywhereDialog } from "./SignOutEverywhereDialog.tsx";
import { useSignOut } from "./useSignOut.ts";
import {
  ChevronAbajoIcon,
  DispositivosIcon,
  SalirIcon,
  UsuarioIcon,
} from "../../components/ui/icons.tsx";

// Menú de la cuenta en el encabezado del espacio de trabajo (HU-009). Es un botón que despliega
// un panel, no un menú de aplicación: se recorre con Tab, se cierra con Escape o con un clic
// fuera y devuelve el foco al botón. Muestra a nombre de quién está la sesión, su organización
// y su rol, y lleva a Mi cuenta. Cerrar todas las sesiones pide confirmación, porque saca
// también a este dispositivo.

export function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
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

  // La organización y el rol van en líneas separadas, no unidos por un separador.
  const organization = me.organization?.name ?? null;
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
          {initialsOf(me.full_name) || <UsuarioIcon size={16} />}
        </span>
        <span className={styles.who}>
          <span className={styles.person}>{me.full_name}</span>
          {organization && (
            <span className={styles.organization}>{organization}</span>
          )}
        </span>
        <ChevronAbajoIcon
          className={styles.chevron}
          size={16}
          aria-hidden="true"
        />
        <span className="visually-hidden">Opciones de la cuenta</span>
      </button>

      <div id={panelId} className={styles.panel} hidden={!open}>
        <div className={styles.account}>
          <p className={styles.panelName}>{me.full_name}</p>
          <p className={styles.panelEmail} translate="no">
            {me.email}
          </p>
          {organization && <p className={styles.panelRole}>{organization}</p>}
          {role && <p className={styles.panelRole}>{`Rol: ${role}`}</p>}
        </div>
        <ul className={styles.actions}>
          <li>
            <Link
              to={ROUTES.account}
              className={styles.action}
              onClick={() => setOpen(false)}
            >
              <UsuarioIcon size={18} aria-hidden="true" />
              <span className={styles.actionText}>
                <span className={styles.actionLabel}>Mi cuenta</span>
                <span className={styles.actionHint}>
                  Perfil, contraseña y sesiones
                </span>
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
              <SalirIcon size={18} aria-hidden="true" />
              <span className={styles.actionText}>
                <span className={styles.actionLabel}>
                  {session.pending === "device"
                    ? "Cerrando la sesión"
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
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
              disabled={session.pending !== null}
            >
              <DispositivosIcon size={18} aria-hidden="true" />
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
        {session.failed && !confirming && (
          <p className={styles.failure} role="alert">
            No pudimos cerrar la sesión. Revise su conexión e inténtelo de
            nuevo.
          </p>
        )}
      </div>

      <SignOutEverywhereDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={session.signOutEverywhere}
        busy={session.pending === "everywhere"}
        failed={session.failed}
      />
    </div>
  );
}
