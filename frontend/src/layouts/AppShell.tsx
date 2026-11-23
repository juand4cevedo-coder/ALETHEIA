import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { ReadMeError } from "../api/generated";
import { readMeOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import logoUrl from "../assets/simbolo.svg";
import { Button } from "../components/ui/Button.tsx";
import { ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL, WORDMARK } from "../config/site.ts";
import { LegalRenewal } from "../features/legal/LegalRenewal.tsx";
import { AccountMenu } from "../features/session/AccountMenu.tsx";
import { WorkspaceNav } from "../features/workspace/WorkspaceNav.tsx";
import {
  forgetSession,
  rememberSession,
} from "../features/session/sessionHint.ts";
import styles from "./AppShell.module.css";
import { BuscarIcon, CargandoIcon } from "../components/ui/icons.tsx";
import { CommandPalette } from "../features/workspace/CommandPalette.tsx";

function isUnauthorized(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as ReadMeError).status === 401
  );
}

// Marco del espacio de trabajo: todo lo que vive bajo /app exige sesión. Pregunta a la API
// quién la tiene (API-014); la API comprueba la sesión en cada petición. Un acceso vencido se
// renueva solo (sessionFetch.ts, HU-009); una sesión cerrada responde 401 y lleva a ingresar,
// recordando la pantalla pedida (NAV-003). El menú de la cuenta cierra la sesión de este
// dispositivo o de todos.
export function AppShell() {
  const location = useLocation();
  const queryClient = useQueryClient();
  // Sin reintentos ni copia vieja: la respuesta dice si la sesión sigue viva ahora.
  const me = useQuery({ ...readMeOptions(), retry: false, staleTime: 0 });
  const signedIn = me.isSuccess;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const sessionEnded = me.isError && isUnauthorized(me.error);

  // Ctrl K (o Cmd K) abre la paleta de comandos desde cualquier pantalla del espacio.
  useEffect(() => {
    if (!signedIn) return;
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signedIn]);

  // El sitio público muestra «Ir a mis casos» mientras haya sesión (sessionHint.ts).
  useEffect(() => {
    if (signedIn) rememberSession();
    if (sessionEnded) {
      forgetSession();
      queryClient.clear();
    }
  }, [queryClient, signedIn, sessionEnded]);

  // Con textos legales nuevos sin aceptar, la pantalla para aceptarlos reemplaza al espacio de
  // trabajo: la API tampoco responde el resto hasta entonces (TT-012, RN-029).
  if (signedIn && me.data.legal.acceptance_required) {
    return <LegalRenewal me={me.data} />;
  }

  if (sessionEnded) {
    // Si el perfil ya había cargado, había una sesión y venció: la pantalla de ingreso lo
    // explica con MSG-012 (NAV-004). Una visita sin sesión llega a ingresar sin aviso.
    return (
      <Navigate
        to={ROUTES.signIn}
        replace
        state={{
          from: `${location.pathname}${location.search}`,
          expired: me.data !== undefined,
        }}
      />
    );
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>
      <header className={styles.header}>
        <Link
          to={me.data?.platform_admin ? ROUTES.platform : ROUTES.app}
          className={styles.brand}
        >
          <img src={logoUrl} alt="" width={28} height={28} />
          <span>{WORDMARK}</span>
        </Link>
        {signedIn && (
          <div className={styles.tools}>
            <button
              type="button"
              className={styles.searchButton}
              onClick={() => setPaletteOpen(true)}
            >
              <BuscarIcon size={18} aria-hidden="true" />
              <span className={styles.searchLabel}>Buscar</span>
              <kbd className={styles.searchKey}>Ctrl K</kbd>
              <span className="visually-hidden">
                Buscar una pantalla o un caso
              </span>
            </button>
            <AccountMenu me={me.data} />
          </div>
        )}
      </header>

      <div className={styles.body}>
        {signedIn && <WorkspaceNav me={me.data} />}
        <main
          key={location.pathname}
          id="contenido"
          className={`${styles.main} page-enter`}
          tabIndex={-1}
          aria-busy={me.isPending}
        >
          {me.isPending && (
            <p className={styles.status} role="status">
              <CargandoIcon
                className={styles.spinner}
                size={16}
                aria-hidden="true"
              />
              Abriendo su espacio de trabajo
            </p>
          )}
          {me.isError && (
            <div className={styles.failure} role="alert">
              {/* MSG-019. */}
              <p>No pudimos abrir su espacio de trabajo.</p>
              <p>
                Inténtelo de nuevo. Si vuelve a pasar, escríbanos a{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void me.refetch()}
              >
                Intentar de nuevo
              </Button>
            </div>
          )}
          {signedIn && <Outlet context={me.data} />}
        </main>
      </div>
      <ScrollRestoration />
      {signedIn && (
        <CommandPalette
          me={me.data}
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
