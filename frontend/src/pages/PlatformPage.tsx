import { FilterPanel } from "../components/ui/FilterPanel.tsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
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
import { Panel } from "../components/ui/Panel.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { pageTitle } from "../config/site.ts";
import styles from "./PlatformPage.module.css";

type AccountFilters = {
  search: string;
  status: "" | "active" | "blocked";
  verification: "" | "verified" | "pending";
  accountType: "" | "platform" | "workspace";
};

const EMPTY_FILTERS: AccountFilters = {
  search: "",
  status: "",
  verification: "",
  accountType: "",
};

export function PlatformPage() {
  const me = useOutletContext<Me>();
  const [filters, setFilters] = useState<AccountFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<AccountFilters>(EMPTY_FILTERS);
  const [cursor, setCursor] = useState<string | undefined>();
  const [previousCursors, setPreviousCursors] = useState<
    (string | undefined)[]
  >([]);
  const [target, setTarget] = useState<PlatformUser | null>(null);
  const [failed, setFailed] = useState(false);
  const queryClient = useQueryClient();
  const accountQuery = {
    search: appliedFilters.search || undefined,
    status: appliedFilters.status || undefined,
    email_verified:
      appliedFilters.verification === ""
        ? undefined
        : appliedFilters.verification === "verified",
    platform_admin:
      appliedFilters.accountType === ""
        ? undefined
        : appliedFilters.accountType === "platform",
    cursor,
  };
  const users = useQuery({
    ...listPlatformUsersOptions({ query: accountQuery }),
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

  function resetPagination() {
    setCursor(undefined);
    setPreviousCursors([]);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetPagination();
    setAppliedFilters({ ...filters, search: filters.search.trim() });
  }

  function clearFilters() {
    resetPagination();
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  }

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
        <Panel
          title="Cuentas"
          description="Bloquear una cuenta cierra sus sesiones en todos los dispositivos."
        >
          <FilterPanel
            active={Object.values(appliedFilters).filter(Boolean).length}
          >
            <form
              className={styles.accountFilters}
              aria-label="Filtrar cuentas"
              onSubmit={applyFilters}
            >
              <label className={styles.filterField}>
                <span>Nombre o correo</span>
                <input
                  type="search"
                  value={filters.search}
                  maxLength={120}
                  placeholder="Ej. carlos@example.com"
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.filterField}>
                <span>Estado</span>
                <select
                  value={filters.status}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value as AccountFilters["status"],
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="active">Activas</option>
                  <option value="blocked">Bloqueadas</option>
                </select>
              </label>
              <label className={styles.filterField}>
                <span>Verificación</span>
                <select
                  value={filters.verification}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      verification: event.target
                        .value as AccountFilters["verification"],
                    }))
                  }
                >
                  <option value="">Todas</option>
                  <option value="verified">Verificadas</option>
                  <option value="pending">Pendientes</option>
                </select>
              </label>
              <label className={styles.filterField}>
                <span>Ámbito</span>
                <select
                  value={filters.accountType}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      accountType: event.target
                        .value as AccountFilters["accountType"],
                    }))
                  }
                >
                  <option value="">Todos</option>
                  <option value="workspace">Despachos</option>
                  <option value="platform">Plataforma</option>
                </select>
              </label>
              <div className={styles.filterActions}>
                <Button size="sm" type="submit">
                  Aplicar filtros
                </Button>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={clearFilters}
                >
                  Limpiar
                </Button>
              </div>
            </form>
          </FilterPanel>
          {users.isPending && <p role="status">Cargando cuentas</p>}
          {users.isError && (
            <Notice tone="error">No pudimos cargar las cuentas.</Notice>
          )}
          {users.data?.items.length === 0 && (
            <p className={styles.empty}>
              No hay cuentas que coincidan con los filtros.
            </p>
          )}
          {users.data && (
            <p className={styles.resultCount} role="status">
              {users.data.total === 1
                ? "1 cuenta encontrada"
                : `${users.data.total} cuentas encontradas`}
            </p>
          )}
          {users.data && users.data.items.length > 0 && (
            <div className={styles.tableScroll}>
              <table className={styles.table} role="table">
                <thead role="rowgroup">
                  <tr role="row">
                    <th scope="col" role="columnheader">
                      Persona
                    </th>
                    <th scope="col" role="columnheader">
                      Correo
                    </th>
                    <th scope="col" role="columnheader">
                      Ámbito
                    </th>
                    <th scope="col" role="columnheader">
                      Estado
                    </th>
                    <th scope="col" role="columnheader">
                      Correo verificado
                    </th>
                    <th scope="col" role="columnheader">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {users.data.items.map((user) => (
                    <tr role="row" key={user.id}>
                      <th scope="row" role="rowheader">
                        {user.full_name}
                      </th>
                      <td role="cell" data-label="Correo" translate="no">
                        {user.email}
                      </td>
                      <td role="cell" data-label="Ámbito">
                        <StatusBadge tone="muted">
                          {user.platform_admin ? "Plataforma" : "Despacho"}
                        </StatusBadge>
                      </td>
                      <td role="cell" data-label="Estado">
                        <StatusBadge
                          tone={user.status === "active" ? "ok" : "error"}
                        >
                          {user.status === "active" ? "Activa" : "Bloqueada"}
                        </StatusBadge>
                      </td>
                      <td role="cell" data-label="Correo verificado">
                        <StatusBadge
                          tone={user.email_verified ? "ok" : "pending"}
                        >
                          {user.email_verified ? "Verificado" : "Pendiente"}
                        </StatusBadge>
                      </td>
                      <td role="cell">
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
          {(previousCursors.length > 0 || users.data?.next_cursor) && (
            <div className={styles.pager}>
              {previousCursors.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setCursor(previousCursors.at(-1));
                    setPreviousCursors((current) => current.slice(0, -1));
                  }}
                >
                  Volver a la página anterior
                </Button>
              )}
              {users.data?.next_cursor && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPreviousCursors((current) => [...current, cursor]);
                    setCursor(users.data.next_cursor ?? undefined);
                  }}
                >
                  Ver más cuentas
                </Button>
              )}
            </div>
          )}
        </Panel>
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
