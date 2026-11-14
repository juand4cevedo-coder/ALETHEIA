import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOutletContext } from "react-router";

import type { Me, PlatformUser } from "../api/generated";
import {
  changePlatformUserStatusMutation,
  listPlatformUsersOptions,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Dialog } from "../components/ui/Dialog.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { pageTitle } from "../config/site.ts";
import styles from "./PlatformPage.module.css";

export function PlatformPage() {
  const me = useOutletContext<Me>();
  const [cursor, setCursor] = useState<string | undefined>();
  const [target, setTarget] = useState<PlatformUser | null>(null);
  const [failed, setFailed] = useState(false);
  const queryClient = useQueryClient();
  const users = useQuery({
    ...listPlatformUsersOptions({ query: cursor ? { cursor } : {} }),
    enabled: me.platform_admin,
    staleTime: 0,
  });
  const change = useMutation({
    ...changePlatformUserStatusMutation(),
    onSuccess: async () => {
      setTarget(null);
      setFailed(false);
      await queryClient.invalidateQueries();
    },
    onError: () => setFailed(true),
  });

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Administración de la plataforma")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Administración de la plataforma"
        description="Gestione el acceso a Aletheia sin entrar a los expedientes de los despachos."
      />
      {!me.platform_admin ? (
        <Notice tone="error">Esta cuenta no administra la plataforma.</Notice>
      ) : (
        <section aria-label="Cuentas" className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>Cuentas</h2>
            <p>
              Bloquear una cuenta cierra sus sesiones en todos los dispositivos.
            </p>
          </div>
          {users.isPending && <p role="status">Cargando cuentas</p>}
          {users.isError && (
            <Notice tone="error">No pudimos cargar las cuentas.</Notice>
          )}
          {users.data?.items.length === 0 && (
            <p>No hay cuentas en esta página.</p>
          )}
          {users.data && users.data.items.length > 0 && (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((user) => (
                    <tr key={user.id}>
                      <th scope="row">{user.full_name}</th>
                      <td translate="no">{user.email}</td>
                      <td>
                        {user.status === "active" ? "Activa" : "Bloqueada"}
                      </td>
                      <td>
                        {!user.platform_admin && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setFailed(false);
                              setTarget(user);
                            }}
                          >
                            {user.status === "active"
                              ? "Bloquear"
                              : "Desbloquear"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {users.data?.next_cursor && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCursor(users.data.next_cursor ?? undefined)}
            >
              Ver más cuentas
            </Button>
          )}
        </section>
      )}
      <Dialog
        open={target !== null}
        onClose={() => !change.isPending && setTarget(null)}
        title={
          target?.status === "active" ? "Bloquear cuenta" : "Desbloquear cuenta"
        }
        busy={change.isPending}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={change.isPending}
              onClick={() => setTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              busy={change.isPending}
              onClick={() => {
                if (!target) return;
                change.mutate({
                  path: { user_id: target.id },
                  body: {
                    status: target.status === "active" ? "blocked" : "active",
                  },
                });
              }}
            >
              {target?.status === "active"
                ? "Bloquear cuenta"
                : "Desbloquear cuenta"}
            </Button>
          </>
        }
      >
        <p>
          {target?.status === "active"
            ? "Se cerrarán las sesiones de "
            : "Se reactivará "}
          <strong translate="no">{target?.email}</strong>.
        </p>
        {failed && (
          <Notice tone="error">
            No pudimos cambiar el estado de la cuenta.
          </Notice>
        )}
      </Dialog>
    </div>
  );
}
