import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { ShareLinkOut } from "../../api/generated";
import {
  createShareLinkMutation,
  listShareLinksOptions,
  listShareLinksQueryKey,
  revokeShareLinkMutation,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import { formatColombiaTime } from "./dates.ts";
import styles from "./ShareEvidencePanel.module.css";

const DURATIONS = [
  { value: "1", label: "1 hora" },
  { value: "24", label: "24 horas" },
  { value: "72", label: "3 días" },
  { value: "168", label: "7 días" },
  { value: "720", label: "30 días" },
];

const STATUS: Record<
  ShareLinkOut["status"],
  { tone: "ok" | "muted" | "error"; label: string }
> = {
  active: { tone: "ok", label: "Vigente" },
  expired: { tone: "muted", label: "Vencido" },
  revoked: { tone: "error", label: "Revocado" },
};

// Compartir una evidencia sin dar una cuenta: un enlace a un solo archivo que vence. Cada
// creación, revocación y descarga queda en la cadena de custodia del caso.
export function ShareEvidencePanel({
  caseId,
  evidenceId,
}: {
  caseId: string;
  evidenceId: string;
}) {
  const queryClient = useQueryClient();
  const path = { case_id: caseId, evidence_id: evidenceId };
  const links = useQuery(listShareLinksOptions({ path }));
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("24");
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<string>();
  const [copied, setCopied] = useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: listShareLinksQueryKey({ path }),
    });
  }

  const create = useMutation({
    ...createShareLinkMutation(),
    onSuccess: async (data) => {
      setCreated(data.url);
      setCopied(false);
      await refresh();
    },
  });
  const revoke = useMutation({
    ...revokeShareLinkMutation(),
    onSuccess: refresh,
    onSettled: () => setRevoking(null),
  });
  const [revoking, setRevoking] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setCreated(undefined);
    setLabel("");
    setHours("24");
    create.reset();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const items = Array.isArray(links.data?.items) ? links.data.items : [];

  return (
    <Panel
      title="Compartir con un enlace"
      description="Un enlace a este único archivo, sin cuenta y con fecha de vencimiento. Quien lo recibe descarga el original ya verificado, y cada uso queda en la cadena de custodia."
    >
      <div className={styles.block}>
        <div>
          <Button onClick={() => setOpen(true)}>Crear un enlace</Button>
        </div>
        {links.isPending && <p role="status">Cargando los enlaces</p>}
        {links.isError && (
          <Notice tone="error">
            <p>No pudimos consultar los enlaces de esta evidencia.</p>
          </Notice>
        )}
        {links.isSuccess && items.length === 0 && (
          <p className={styles.empty}>Todavía no ha creado enlaces.</p>
        )}
        {items.length > 0 && (
          <ul className={styles.list} aria-label="Enlaces de esta evidencia">
            {items.map((link) => (
              <li key={link.id} className={styles.item}>
                <div className={styles.main}>
                  <strong>{link.label ?? "Sin nota"}</strong>
                  <span>
                    Creado por {link.created_by_name}. Vence el{" "}
                    {formatColombiaTime(link.expires_at)}.
                  </span>
                  <span>
                    {link.download_count === 0
                      ? "Sin descargas todavía."
                      : `${link.download_count} ${
                          link.download_count === 1 ? "descarga" : "descargas"
                        }, la última el ${formatColombiaTime(
                          link.last_downloaded_at ?? link.created_at,
                        )}.`}
                  </span>
                </div>
                <div className={styles.side}>
                  <StatusBadge tone={STATUS[link.status].tone}>
                    {STATUS[link.status].label}
                  </StatusBadge>
                  {link.status === "active" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      busy={revoke.isPending}
                      onClick={() => setRevoking(link.id)}
                    >
                      Revocar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={open}
        onClose={close}
        title={created ? "Enlace creado" : "Crear un enlace para compartir"}
        busy={create.isPending}
        actions={
          created ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void copy(created)}
              >
                {copied ? "Copiado" : "Copiar el enlace"}
              </Button>
              <Button size="sm" onClick={close}>
                Listo
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={close}>
                Cancelar
              </Button>
              <Button
                size="sm"
                busy={create.isPending}
                onClick={() =>
                  create.mutate({
                    path,
                    body: {
                      expires_in_hours: Number(hours),
                      label: label.trim() || null,
                    },
                  })
                }
              >
                Crear el enlace
              </Button>
            </>
          )
        }
      >
        {created ? (
          <div className={styles.created}>
            <Notice tone="warning">
              <p>
                Cópielo ahora: no se vuelve a mostrar. Quien tenga este enlace
                puede descargar el archivo hasta que venza o usted lo revoque.
              </p>
            </Notice>
            <input
              className={styles.url}
              readOnly
              value={created}
              aria-label="Enlace para compartir"
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        ) : (
          <div className={styles.form}>
            <Select
              label="Vigencia"
              value={hours}
              options={DURATIONS}
              onChange={(event) => setHours(event.target.value)}
              help="Pasado ese tiempo el enlace deja de funcionar solo."
            />
            <Field
              label="Nota (opcional)"
              value={label}
              maxLength={120}
              onChange={(event) => setLabel(event.target.value)}
              help="Para recordar a quién se lo envió. Quien lo recibe no la ve."
            />
            {create.error && (
              <Notice tone="error">
                {apiProblem(create.error).detail ??
                  "No pudimos crear el enlace."}
              </Notice>
            )}
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={revoking !== null}
        title="¿Revocar este enlace?"
        confirmLabel="Revocar el enlace"
        destructive
        busy={revoke.isPending}
        onCancel={() => setRevoking(null)}
        onConfirm={() =>
          revoking && revoke.mutate({ path: { ...path, link_id: revoking } })
        }
      >
        <p>Quien lo tenga ya no podrá descargar el archivo.</p>
      </ConfirmDialog>
    </Panel>
  );
}
