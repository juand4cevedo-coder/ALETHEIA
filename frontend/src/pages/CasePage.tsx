import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router";

import type { CaseDetail, CaseMemberOut, Me } from "../api/generated";
import {
  addCaseMemberMutation,
  availableCaseMembersOptions,
  availableCaseMembersQueryKey,
  closeCaseMutation,
  listCasesQueryKey,
  readCaseOptions,
  readCaseQueryKey,
  removeCaseMemberMutation,
  reopenCaseMutation,
  updateCaseRetentionMutation,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { Dialog } from "../components/ui/Dialog.tsx";
import { FilingNumber } from "../components/ui/FilingNumber.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Select } from "../components/ui/Select.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { CustodySection } from "../features/cases/CustodySection.tsx";
import { EvidenceSection } from "../features/cases/EvidenceSection.tsx";
import { ExportSection } from "../features/cases/ExportSection.tsx";
import { NotesSection } from "../features/cases/NotesSection.tsx";
import { TaskSection } from "../features/cases/TaskSection.tsx";
import { formatColombiaTime } from "../features/cases/dates.ts";
import { PRACTICE_AREA_LABELS } from "../features/cases/practiceAreas.ts";
import { initialsOf } from "../features/session/initials.ts";
import { ROLE_LABELS } from "../features/workspace/roles.ts";
import styles from "./CasePage.module.css";
import {
  BalanzaIcon,
  CargandoIcon,
  CarpetaAbiertaIcon,
} from "../components/ui/icons.tsx";

type TabKey = "chain" | "team" | "tasks" | "notes" | "evidence" | "export";
const TAB_ORDER: readonly TabKey[] = [
  "chain",
  "team",
  "tasks",
  "notes",
  "evidence",
  "export",
];

/** El caso no existe, es de otra organización o su id no es válido: MSG-011 en los tres casos. */
function isMissing(error: unknown): boolean {
  const { status } = apiProblem(error);
  return status === 404 || status === 422;
}

// El caso (HU-015, maqueta 03): su identidad procesal, la cadena de custodia desde el evento 1 y
// el equipo y la carga cifrada. La verificación de la cadena llegará con su historia.
export function CasePage() {
  const me = useOutletContext<Me>();
  const { caseId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // El aviso se guarda al llegar y el estado se borra del historial: se ve en esta visita, pero
  // no otra vez al recargar ni al volver atrás.
  const [justOpened] = useState(
    () =>
      (location.state as { justOpened?: boolean } | null)?.justOpened === true,
  );
  useEffect(() => {
    if (justOpened) {
      void navigate(location.pathname, { replace: true, state: null });
    }
  }, [justOpened, location.pathname, navigate]);
  const detail = useQuery({
    ...readCaseOptions({ path: { case_id: caseId } }),
    // Un caso inexistente, ajeno o con un id mal formado (422 de la ruta) no cambia con otro
    // intento: MSG-011 se muestra de inmediato. Las fallas de red o del servidor sí se reintentan.
    retry: (failureCount, error) => !isMissing(error) && failureCount < 2,
  });

  if (detail.isPending) {
    return (
      <div className={styles.screen}>
        <title>{pageTitle("Caso")}</title>
        <meta name="robots" content="noindex" />
        <p className={styles.loading} role="status">
          <CargandoIcon
            className={styles.spinner}
            size={16}
            aria-hidden="true"
          />
          Abriendo el caso
        </p>
      </div>
    );
  }

  if (detail.isError) {
    const missing = isMissing(detail.error);
    const { requestId } = apiProblem(detail.error);
    return (
      <div className={styles.screen}>
        <title>{pageTitle("Caso no disponible")}</title>
        <meta name="robots" content="noindex" />
        <div className={styles.unavailable}>
          <PageHeader title="Caso no disponible" />
          <Notice tone={missing ? "info" : "error"}>
            {missing ? (
              <p>{MESSAGES.notFound}</p>
            ) : (
              <SystemError requestId={requestId} />
            )}
          </Notice>
          <div className={styles.unavailableActions}>
            {!missing && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void detail.refetch()}
              >
                Intentar de nuevo
              </Button>
            )}
            <ButtonLink to={ROUTES.cases} variant="secondary" size="sm">
              Volver a los casos
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CaseView
      key={detail.data.id}
      detail={detail.data}
      justOpened={justOpened}
      me={me}
    />
  );
}

function referenceLine(detail: CaseDetail) {
  if (detail.filing_number) {
    return <FilingNumber digits={detail.filing_number} />;
  }
  if (!detail.internal_reference) return "Sin radicado";
  return (
    <>
      {"Sin radicado, referencia interna "}
      <code translate="no">{detail.internal_reference}</code>
    </>
  );
}

function CaseView({
  detail,
  justOpened,
  me,
}: {
  detail: CaseDetail;
  justOpened: boolean;
  me: Me;
}) {
  const location = useLocation();
  const [tab, setTab] = useState<TabKey>(
    location.hash === "#evidencias"
      ? "evidence"
      : location.hash === "#tareas"
        ? "tasks"
        : "chain",
  );
  const canExport = ["owner", "admin", "lawyer"].includes(
    me.organization?.role ?? "",
  );
  const tabOrder = canExport
    ? TAB_ORDER
    : TAB_ORDER.filter((key) => key !== "export");
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    chain: null,
    team: null,
    tasks: null,
    notes: null,
    evidence: null,
    export: null,
  });
  const ids = {
    chain: useId(),
    team: useId(),
    tasks: useId(),
    notes: useId(),
    evidence: useId(),
    export: useId(),
  };
  // La API entrega los últimos eventos; el número del más reciente es el total de la cadena.
  const eventCount = detail.recent_events.reduce(
    (max, event) => Math.max(max, event.seq),
    0,
  );

  // Pestañas según el patrón WAI-ARIA: las flechas, Inicio y Fin mueven el foco y la selección.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabOrder.indexOf(tab);
    const moves: Record<string, number> = {
      ArrowRight: (index + 1) % tabOrder.length,
      ArrowLeft: (index - 1 + tabOrder.length) % tabOrder.length,
      Home: 0,
      End: tabOrder.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const key = tabOrder[next]!;
    setTab(key);
    tabRefs.current[key]?.focus();
  }

  const tabs: { key: TabKey; label: string; count?: number; unit?: string }[] =
    [
      {
        key: "chain",
        label: "Cadena de custodia",
        count: eventCount,
        unit: eventCount === 1 ? "evento" : "eventos",
      },
      {
        key: "team",
        label: "Equipo",
        count: detail.member_count,
        unit: detail.member_count === 1 ? "persona" : "personas",
      },
      { key: "tasks", label: "Tareas y plazos" },
      { key: "notes", label: "Notas" },
      { key: "evidence", label: "Evidencias" },
      ...(canExport ? [{ key: "export" as const, label: "Paquete" }] : []),
    ];

  const opened = `Abierto el ${formatColombiaTime(detail.created_at)} por ${detail.created_by_name}`;

  return (
    <div className={styles.screen}>
      <title>{pageTitle(detail.title)}</title>
      <meta name="robots" content="noindex" />

      {justOpened && (
        <Notice tone="success">
          <p>Caso abierto. Su cadena de custodia comenzó.</p>
        </Notice>
      )}

      <div className={styles.case}>
        <header className={styles.hero}>
          <p className={styles.reference}>{referenceLine(detail)}</p>
          <h1 className={styles.title}>{detail.title}</h1>
          <ul className={styles.chips} aria-label="Datos del caso">
            {detail.practice_area && (
              <li className={styles.chip}>
                {PRACTICE_AREA_LABELS[detail.practice_area]}
              </li>
            )}
            {detail.court && <li className={styles.chip}>{detail.court}</li>}
            <li className={styles.chip}>{opened}</li>
          </ul>
          <CaseLifecycle detail={detail} me={me} />

          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Secciones del caso"
            onKeyDown={handleKeyDown}
          >
            {tabs.map(({ key, label, count, unit }) => (
              <button
                key={key}
                ref={(node) => {
                  tabRefs.current[key] = node;
                }}
                type="button"
                role="tab"
                id={`${ids[key]}-tab`}
                className={styles.tab}
                aria-selected={tab === key}
                aria-controls={`${ids[key]}-panel`}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
              >
                <span>{label}</span>
                {count !== undefined && (
                  <>
                    <span className={styles.count} aria-hidden="true">
                      {count}
                    </span>
                    <span className="visually-hidden">{`, ${count} ${unit}`}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </header>

        <div
          role="tabpanel"
          id={`${ids.chain}-panel`}
          aria-labelledby={`${ids.chain}-tab`}
          className={styles.tabPanel}
          tabIndex={0}
          hidden={tab !== "chain"}
        >
          {/* La pestaña ya nombra el panel: el título de la cadena solo lo oye el lector de
              pantalla, para que la navegación por encabezados la encuentre. */}
          <div className={styles.chainLayout}>
            <div>
              <h2 className="visually-hidden">Cadena de custodia</h2>
              <p className={styles.caption}>
                Cada evento lleva la huella del anterior. Si alguien alterara
                uno, la cadena dejaría de cuadrar.
              </p>
              {tab === "chain" && (
                <CustodySection caseId={detail.id} justOpened={justOpened} />
              )}
            </div>
            <CaseFacts detail={detail} />
          </div>
        </div>
        <div
          role="tabpanel"
          id={`${ids.team}-panel`}
          aria-labelledby={`${ids.team}-tab`}
          className={styles.tabPanel}
          tabIndex={0}
          hidden={tab !== "team"}
        >
          <p className={styles.caption}>
            Quienes trabajan en este caso y ven sus datos.
          </p>
          {tab === "team" && <TeamList detail={detail} me={me} />}
        </div>
        <div
          role="tabpanel"
          id={`${ids.tasks}-panel`}
          aria-labelledby={`${ids.tasks}-tab`}
          className={styles.tabPanel}
          tabIndex={0}
          hidden={tab !== "tasks"}
        >
          {tab === "tasks" && (
            <TaskSection
              caseId={detail.id}
              members={detail.members}
              role={me.organization?.role}
              currentUserId={me.id}
              caseOpen={detail.status === "open"}
            />
          )}
        </div>
        <div
          role="tabpanel"
          id={`${ids.notes}-panel`}
          aria-labelledby={`${ids.notes}-tab`}
          className={styles.tabPanel}
          tabIndex={0}
          hidden={tab !== "notes"}
        >
          {tab === "notes" && (
            <NotesSection
              caseId={detail.id}
              caseOpen={detail.status === "open"}
            />
          )}
        </div>
        <div
          role="tabpanel"
          id={`${ids.evidence}-panel`}
          aria-labelledby={`${ids.evidence}-tab`}
          className={styles.tabPanel}
          tabIndex={0}
          hidden={tab !== "evidence"}
        >
          {tab === "evidence" && (
            <EvidenceSection
              caseId={detail.id}
              canUpload={detail.status === "open"}
            />
          )}
        </div>
        {canExport && (
          <div
            role="tabpanel"
            id={`${ids.export}-panel`}
            aria-labelledby={`${ids.export}-tab`}
            className={styles.tabPanel}
            tabIndex={0}
            hidden={tab !== "export"}
          >
            {tab === "export" && <ExportSection caseId={detail.id} />}
          </div>
        )}
      </div>
    </div>
  );
}

function CaseLifecycle({ detail, me }: { detail: CaseDetail; me: Me }) {
  const queryClient = useQueryClient();
  const role = me.organization?.role;
  const canManage = role === "owner" || role === "admin" || role === "lawyer";
  const canManageRetention = role === "owner" || role === "admin";
  const [confirming, setConfirming] = useState(false);
  const [managingRetention, setManagingRetention] = useState(false);
  const [retentionBasis, setRetentionBasis] = useState<
    NonNullable<CaseDetail["retention_basis"]>
  >(detail.retention_basis ?? "organization_policy");
  const [message, setMessage] = useState("");
  const path = { case_id: detail.id };
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: readCaseQueryKey({ path }) }),
      queryClient.invalidateQueries({ queryKey: listCasesQueryKey() }),
    ]);
  };
  const close = useMutation({
    ...closeCaseMutation(),
    onSuccess: async () => {
      setConfirming(false);
      setMessage("Caso cerrado y trasladado al archivo.");
      await refresh();
    },
  });
  const reopen = useMutation({
    ...reopenCaseMutation(),
    onSuccess: async () => {
      setConfirming(false);
      setMessage(
        "Caso reabierto. Su historial de cierre permanece en la cadena.",
      );
      await refresh();
    },
  });
  const retention = useMutation({
    ...updateCaseRetentionMutation(),
    onSuccess: async () => {
      setManagingRetention(false);
      setMessage("Conservación actualizada y registrada en la trazabilidad.");
      await refresh();
    },
  });
  const mutation = detail.status === "open" ? close : reopen;
  const error = mutation.error;

  return (
    <div className={styles.lifecycle}>
      <div className={styles.lifecycleCopy}>
        <strong>
          {detail.status === "open"
            ? "Expediente activo"
            : "Archivo de casos cerrados"}
        </strong>
        <span>
          {detail.status === "open"
            ? "Al cerrarlo, el expediente y su cadena permanecen conservados y consultables."
            : detail.retention_until
              ? `Conservación programada, como mínimo, hasta el ${formatColombiaTime(detail.retention_until)}.`
              : "El expediente permanece conservado con toda su trazabilidad."}
        </span>
        {detail.status === "closed" && (
          <span className={styles.retentionStatus}>
            <StatusBadge tone={detail.legal_hold ? "closed" : "muted"}>
              {detail.legal_hold
                ? "Bloqueo jurídico activo"
                : detail.retention_basis === "legal_or_contractual_duty"
                  ? "Deber legal o contractual"
                  : "Política del despacho"}
            </StatusBadge>
          </span>
        )}
      </div>
      {canManage && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          {detail.status === "open" ? "Cerrar y archivar" : "Reabrir caso"}
        </Button>
      )}
      {detail.status === "closed" && canManageRetention && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setRetentionBasis(detail.retention_basis ?? "organization_policy");
            setManagingRetention(true);
          }}
        >
          Gestionar conservación
        </Button>
      )}
      {message && (
        <span className={styles.lifecycleMessage} role="status">
          {message}
        </span>
      )}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={
          detail.status === "open"
            ? "Cerrar y archivar el caso"
            : "Reabrir el caso"
        }
        icon={
          detail.status === "open" ? (
            <BalanzaIcon size={24} />
          ) : (
            <CarpetaAbiertaIcon size={24} />
          )
        }
        busy={mutation.isPending}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              data-autofocus
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              busy={mutation.isPending}
              onClick={() => mutation.mutate({ path })}
            >
              {detail.status === "open" ? "Cerrar y conservar" : "Reabrir"}
            </Button>
          </>
        }
      >
        {detail.status === "open" ? (
          <p>
            El caso dejará de aceptar nuevas evidencias. No se borrará ningún
            dato, archivo, llave ni evento de custodia; podrá consultarse y
            exportarse desde el archivo.
          </p>
        ) : (
          <p>
            El caso volverá a admitir trabajo y evidencias. El cierre anterior
            seguirá registrado en la cadena de custodia y en la auditoría del
            despacho.
          </p>
        )}
        {error && (
          <Notice tone="error">
            {apiProblem(error).detail ??
              "No pudimos cambiar el estado del caso."}
          </Notice>
        )}
      </Dialog>
      <Dialog
        open={managingRetention}
        onClose={() => setManagingRetention(false)}
        title="Gestionar conservación"
        icon={<BalanzaIcon size={24} />}
        busy={retention.isPending}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              data-autofocus
              onClick={() => setManagingRetention(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              busy={retention.isPending}
              onClick={() =>
                retention.mutate({
                  path,
                  body: {
                    retention_basis: retentionBasis,
                    legal_hold: retentionBasis === "litigation_hold",
                  },
                })
              }
            >
              Guardar y registrar
            </Button>
          </>
        }
      >
        <p>
          El cambio quedará en la cadena de custodia y en la auditoría del
          despacho. Un bloqueo jurídico impide cualquier proceso de supresión
          mientras permanezca activo.
        </p>
        <Select
          label="Fundamento de conservación"
          value={retentionBasis}
          onChange={(event) =>
            setRetentionBasis(
              event.target.value as NonNullable<CaseDetail["retention_basis"]>,
            )
          }
          options={[
            {
              value: "organization_policy",
              label: "Política del despacho",
            },
            {
              value: "legal_or_contractual_duty",
              label: "Deber legal o contractual",
            },
            {
              value: "litigation_hold",
              label: "Bloqueo jurídico por litigio",
            },
          ]}
          help={
            retentionBasis === "litigation_hold"
              ? "Activa el bloqueo jurídico del expediente."
              : "Mantiene la fecha mínima de revisión ya registrada."
          }
        />
        {retention.error && (
          <Notice tone="error">
            {apiProblem(retention.error).detail ??
              "No pudimos actualizar la conservación."}
          </Notice>
        )}
      </Dialog>
    </div>
  );
}

function CaseFacts({ detail }: { detail: CaseDetail }) {
  const headingId = useId();
  return (
    <section className={styles.facts} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.factsTitle}>
        Datos procesales
      </h2>
      <dl className={styles.factList}>
        <div>
          <dt>Número de radicación</dt>
          <dd className={styles.filingParts}>
            {detail.filing_number ? (
              <FilingNumber digits={detail.filing_number} breakdown />
            ) : (
              "Sin radicado"
            )}
          </dd>
        </div>
        <div>
          <dt>Referencia interna</dt>
          <dd translate={detail.internal_reference ? "no" : undefined}>
            {detail.internal_reference ?? "Sin especificar"}
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          {/* Tono neutro: el verde queda para cuando el verificador independiente haya
              comprobado la cadena (HU-024), nunca por defecto. */}
          <dd>
            {detail.status === "open" ? (
              <StatusBadge tone="muted">Abierto</StatusBadge>
            ) : (
              <StatusBadge tone="closed">Cerrado</StatusBadge>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Quien abrió el caso quedó como su primer miembro, con su nombre. */
function creatorOf(detail: CaseDetail): CaseMemberOut | undefined {
  return detail.members
    .filter((member) => member.full_name === detail.created_by_name)
    .sort((a, b) => a.added_at.localeCompare(b.added_at))[0];
}

function TeamList({ detail, me }: { detail: CaseDetail; me: Me }) {
  const creator = creatorOf(detail);
  const queryClient = useQueryClient();
  const role = me.organization?.role;
  const canManage = role === "owner" || role === "admin" || role === "lawyer";
  const path = { case_id: detail.id };
  const [selectedId, setSelectedId] = useState("");
  const [removing, setRemoving] = useState<CaseMemberOut | null>(null);
  const [message, setMessage] = useState("");
  const candidates = useQuery({
    ...availableCaseMembersOptions({ path }),
    enabled: canManage,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: readCaseQueryKey({ path }) }),
      queryClient.invalidateQueries({
        queryKey: availableCaseMembersQueryKey({ path }),
      }),
      queryClient.invalidateQueries({ queryKey: listCasesQueryKey() }),
    ]);
  };
  const add = useMutation({
    ...addCaseMemberMutation(),
    onSuccess: async () => {
      setSelectedId("");
      setMessage("Persona asignada al caso.");
      await refresh();
    },
  });
  const remove = useMutation({
    ...removeCaseMemberMutation(),
    onSuccess: async () => {
      setMessage("Persona retirada del caso. Sigue perteneciendo al despacho.");
      setRemoving(null);
      await refresh();
    },
  });
  return (
    <>
      {message && <Notice tone="success">{message}</Notice>}
      {canManage && (
        <form
          className={styles.memberForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedId) {
              setMessage("");
              add.mutate({ path, body: { user_id: selectedId } });
            }
          }}
        >
          <Select
            label="Agregar a una persona del despacho"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={candidates.isPending || add.isPending}
            options={[
              { value: "", label: "Seleccione una persona" },
              ...(candidates.data ?? []).map((candidate) => ({
                value: candidate.user_id,
                label: `${candidate.full_name} (${candidate.email})`,
              })),
            ]}
          />
          <Button
            type="submit"
            size="sm"
            busy={add.isPending}
            disabled={!selectedId}
          >
            Asignar al caso
          </Button>
          {candidates.isError && (
            <Notice tone="error">
              No pudimos cargar las personas disponibles.
            </Notice>
          )}
          {add.isError && (
            <Notice tone="error">
              {apiProblem(add.error).detail ??
                "No pudimos asignar a esta persona. Actualice el equipo e inténtelo de nuevo."}
            </Notice>
          )}
        </form>
      )}
      <ul className={styles.members}>
        {detail.members.map((member) => (
          <li key={member.user_id} className={styles.member}>
            <span className={styles.avatar} aria-hidden="true">
              {initialsOf(member.full_name)}
            </span>
            <span className={styles.who}>
              <span className={styles.memberName}>{member.full_name}</span>
              <span className={styles.memberEmail}>{member.email}</span>
            </span>
            <span className={styles.role}>
              {ROLE_LABELS[member.role]}
              {member === creator && (
                <span className={styles.roleNote}>Abrió el caso</span>
              )}
            </span>
            {canManage && member.user_id !== me.id && (
              <Button
                variant="text"
                size="sm"
                aria-label={`Retirar a ${member.full_name} del caso`}
                onClick={() => setRemoving(member)}
              >
                Retirar
              </Button>
            )}
          </li>
        ))}
      </ul>
      {removing && (
        <div
          className={styles.removeConfirm}
          role="group"
          aria-label="Confirmar retiro del caso"
        >
          <p>
            ¿Retirar a {removing.full_name} de este caso? Conservará su acceso
            al despacho.
          </p>
          <Button
            variant="secondary"
            size="sm"
            busy={remove.isPending}
            onClick={() => {
              setMessage("");
              remove.mutate({ path: { ...path, user_id: removing.user_id } });
            }}
          >
            Confirmar retiro
          </Button>
          <Button variant="text" size="sm" onClick={() => setRemoving(null)}>
            Cancelar
          </Button>
          {remove.isError && (
            <Notice tone="error">No pudimos retirar a esta persona.</Notice>
          )}
        </div>
      )}
    </>
  );
}
