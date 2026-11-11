import { useMutation } from "@tanstack/react-query";
import { CircleCheck, MailCheck, ShieldAlert } from "lucide-react";
import {
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useNavigate, useOutletContext } from "react-router";

import type { CaseCreate, Me } from "../api/generated";
import { createCaseMutation } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { Dialog } from "../components/ui/Dialog.tsx";
import { Field } from "../components/ui/Field.tsx";
import { FilingNumber } from "../components/ui/FilingNumber.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Select } from "../components/ui/Select.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { ROUTES } from "../config/routes.ts";
import { SITE_NAME } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { ResendVerification } from "../features/auth/ResendVerification.tsx";
import {
  CASE_MESSAGES,
  FILING_NUMBER_TAKEN_PROBLEM,
  NOT_ALLOWED,
} from "../features/cases/messages.ts";
import {
  FILING_LENGTH,
  isValidFilingNumber,
  normalizeFilingNumber,
} from "../features/cases/filingNumber.ts";
import { OpeningRecordPreview } from "../features/cases/OpeningRecordPreview.tsx";
import {
  PRACTICE_AREA_LABELS,
  type PracticeArea,
} from "../features/cases/practiceAreas.ts";
import { canOpenCases } from "../features/cases/roles.ts";
import { ROLE_LABELS } from "../features/workspace/roles.ts";
import styles from "./NewCasePage.module.css";

// Mismos límites que la API (CaseCreate).
const TITLE_MAX_LENGTH = 160;
const COURT_MAX_LENGTH = 160;
const REFERENCE_MAX_LENGTH = 80;
// Un radicado pegado con separadores ocupa más que sus 23 dígitos.
const FILING_INPUT_MAX_LENGTH = 40;

type FieldKey =
  "title" | "filingNumber" | "practiceArea" | "internalReference" | "court";
type FieldErrors = Partial<Record<FieldKey, string>>;

// Orden de los campos en el formulario: el foco va al primero que tenga un error.
const FIELD_ORDER: readonly FieldKey[] = [
  "title",
  "filingNumber",
  "practiceArea",
  "internalReference",
  "court",
];

// Campo de la API (loc de un 422) y su campo en el formulario, con su mensaje.
const API_FIELDS: Record<string, { field: FieldKey; message: string }> = {
  title: { field: "title", message: CASE_MESSAGES.title },
  filing_number: {
    field: "filingNumber",
    message: CASE_MESSAGES.invalidFilingNumber,
  },
  practice_area: {
    field: "practiceArea",
    message: CASE_MESSAGES.practiceArea,
  },
  internal_reference: {
    field: "internalReference",
    message: CASE_MESSAGES.internalReference,
  },
  court: { field: "court", message: CASE_MESSAGES.court },
};

const PRACTICE_AREA_OPTIONS = [
  { value: "", label: "Sin especificar" },
  ...Object.entries(PRACTICE_AREA_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const NO_PROCESS_YET =
  "Si aún no hay proceso, déjelo vacío y agréguelo cuando lo radique.";

type Failure =
  { kind: "message"; text: string } | { kind: "system"; requestId?: string };

/** Errores de campo de un 422, por su ubicación en el cuerpo (["body", "title"]). */
function fieldErrorsFrom(error: unknown): FieldErrors {
  const entries =
    typeof error === "object" && error !== null && "errors" in error
      ? (error as { errors?: unknown }).errors
      : undefined;
  const errors: FieldErrors = {};
  if (!Array.isArray(entries)) return errors;
  for (const entry of entries) {
    const loc = (entry as { loc?: unknown })?.loc;
    const name = Array.isArray(loc) ? loc[1] : undefined;
    const known = typeof name === "string" ? API_FIELDS[name] : undefined;
    if (known) errors[known.field] = known.message;
  }
  return errors;
}

function filingHelp(digits: string): string {
  if (!digits) return NO_PROCESS_YET;
  if (isValidFilingNumber(digits)) return `23 dígitos. ${NO_PROCESS_YET}`;
  const count = digits.replace(/\D/g, "").length;
  if (count > FILING_LENGTH) {
    return `Tiene ${count} dígitos: sobran ${count - FILING_LENGTH}.`;
  }
  return `Lleva ${count} de ${FILING_LENGTH} dígitos.`;
}

// Abrir un caso (HU-015, maqueta 02): el formulario a la izquierda y, a la derecha, la vista
// previa del registro de apertura que inicia la cadena de custodia. Lo abren el propietario,
// el administrador y el abogado (RN-008); la API también lo exige.
export function NewCasePage() {
  const me = useOutletContext<Me>();

  return (
    <div className={styles.screen}>
      <title>{`Abrir un caso · ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />
      {canOpenCases(me.organization?.role) ? (
        <NewCaseForm me={me} />
      ) : (
        <div className={styles.denied}>
          <PageHeader eyebrow="Nuevo expediente" title="Abrir un caso" />
          <Notice tone="error">
            <p>{NOT_ALLOWED}</p>
          </Notice>
          <div>
            <ButtonLink
              to={ROUTES.app}
              variant="secondary"
              surface="dark"
              size="sm"
              shape="pill"
            >
              Volver al inicio
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}

function NewCaseForm({ me }: { me: Me }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [filing, setFiling] = useState("");
  const [practiceArea, setPracticeArea] = useState<PracticeArea | "">("");
  const [internalReference, setInternalReference] = useState("");
  const [court, setCourt] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [verifying, setVerifying] = useState(false);
  // El botón se deshabilita al enviar, pero un doble clic llega antes de que React lo pinte:
  // esta marca descarta el segundo envío (punto de revisión 3).
  const submitting = useRef(false);
  const failureRef = useRef<HTMLDivElement>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const filingRef = useRef<HTMLInputElement>(null);
  const practiceAreaRef = useRef<HTMLSelectElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  const courtRef = useRef<HTMLInputElement>(null);
  const refs: Record<
    FieldKey,
    RefObject<HTMLInputElement | HTMLSelectElement | null>
  > = {
    title: titleRef,
    filingNumber: filingRef,
    practiceArea: practiceAreaRef,
    internalReference: referenceRef,
    court: courtRef,
  };

  const titleHelpId = useId();
  const filingHelpId = useId();
  const referenceHelpId = useId();
  const courtHelpId = useId();

  const digits = normalizeFilingNumber(filing);
  const filingValid = isValidFilingNumber(digits);
  // Con el radicado repetido, el formato es correcto pero el aviso verde lo contradiría.
  const filingOk = filingValid && !errors.filingNumber;
  const ready = title.trim().length > 0 && (!digits || filingValid);

  const create = useMutation({
    ...createCaseMutation(),
    onSuccess: (created) => {
      void navigate(ROUTES.caseDetail(created.id), {
        state: { justOpened: true },
      });
    },
    onError: (error) => {
      const { status, type, detail, requestId } = apiProblem(error);
      if (status === 409 && type === FILING_NUMBER_TAKEN_PROBLEM) {
        showFieldErrors({ filingNumber: CASE_MESSAGES.filingNumberTaken });
        return;
      }
      if (status === 422) {
        const fieldErrors = fieldErrorsFrom(error);
        if (Object.keys(fieldErrors).length > 0) {
          showFieldErrors(fieldErrors);
          return;
        }
      }
      // El 503 de KMS trae su propio texto; otro 503 (la base caída) muestra el detalle que
      // mande la API o, sin él, el error del sistema.
      if (status === 503 && detail === CASE_MESSAGES.keysUnavailable) {
        setFailure({ kind: "message", text: CASE_MESSAGES.keysUnavailable });
        return;
      }
      if ((status === 403 || status === 409 || status === 503) && detail) {
        setFailure({ kind: "message", text: detail });
        return;
      }
      setFailure({ kind: "system", requestId });
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  // Un aviso de error recibe el foco para que el teclado y el lector lo encuentren.
  useEffect(() => {
    if (failure) failureRef.current?.focus();
  }, [failure]);

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    const first = FIELD_ORDER.find((key) => next[key]);
    if (first) refs[first].current?.focus();
  }

  function clearError(key: FieldKey) {
    if (!errors[key]) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length > TITLE_MAX_LENGTH) {
      found.title = CASE_MESSAGES.title;
    }
    if (digits && !filingValid) {
      found.filingNumber = CASE_MESSAGES.invalidFilingNumber;
    }
    if (internalReference.trim().length > REFERENCE_MAX_LENGTH) {
      found.internalReference = CASE_MESSAGES.internalReference;
    }
    if (court.trim().length > COURT_MAX_LENGTH) {
      found.court = CASE_MESSAGES.court;
    }
    return found;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || create.isPending) return;
    // Con el correo sin verificar, la API respondería 403: el botón explica por qué antes.
    if (!me.email_verified) {
      setVerifying(true);
      return;
    }
    setFailure(null);
    const found = validate();
    if (Object.keys(found).length > 0) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    const body: CaseCreate = { title: title.trim() };
    if (digits) body.filing_number = digits;
    if (practiceArea) body.practice_area = practiceArea;
    if (internalReference.trim()) {
      body.internal_reference = internalReference.trim();
    }
    if (court.trim()) body.court = court.trim();
    submitting.current = true;
    create.mutate({ body });
  }

  const role = me.organization?.role;
  const openedBy = role
    ? `${me.full_name} · ${ROLE_LABELS[role]}`
    : me.full_name;

  return (
    <>
      <div className={styles.compose}>
        <div className={styles.formPanel}>
          <PageHeader eyebrow="Nuevo expediente" title="Abrir un caso" />
          <form
            className={styles.form}
            aria-label="Abrir un caso"
            noValidate
            onSubmit={handleSubmit}
          >
            <Field
              ref={titleRef}
              label="Título del caso"
              name="titulo"
              required
              autoComplete="off"
              maxLength={TITLE_MAX_LENGTH}
              value={title}
              error={errors.title}
              describedBy={titleHelpId}
              onChange={(event) => {
                setTitle(event.target.value);
                clearError("title");
              }}
            >
              <p id={titleHelpId} className={styles.help}>
                <span>
                  Así lo verá su equipo y así aparecerá en el informe de
                  custodia.
                </span>
                <span className={styles.counter}>
                  {`${title.length} de ${TITLE_MAX_LENGTH}`}
                </span>
              </p>
            </Field>

            <Field
              ref={filingRef}
              label="Número de radicación (opcional)"
              name="radicado"
              autoComplete="off"
              inputMode="numeric"
              spellCheck={false}
              maxLength={FILING_INPUT_MAX_LENGTH}
              value={filing}
              error={errors.filingNumber}
              describedBy={filingHelpId}
              onChange={(event) => {
                const next = event.target.value;
                setFiling(next);
                const nextDigits = normalizeFilingNumber(next);
                // El error de formato se va cuando el radicado queda bien; el de repetido, con
                // cualquier cambio.
                if (
                  errors.filingNumber === CASE_MESSAGES.filingNumberTaken ||
                  !nextDigits ||
                  isValidFilingNumber(nextDigits)
                ) {
                  clearError("filingNumber");
                }
              }}
              onBlur={() => {
                if (digits && !filingValid) {
                  setErrors((current) => ({
                    ...current,
                    filingNumber: CASE_MESSAGES.invalidFilingNumber,
                  }));
                }
              }}
            >
              {digits && (
                <div
                  className={styles.breakdown}
                  role="group"
                  aria-label="Partes del número de radicación"
                >
                  <FilingNumber
                    digits={digits.slice(0, FILING_LENGTH)}
                    breakdown
                  />
                </div>
              )}
              <p
                id={filingHelpId}
                className={styles.help}
                data-tone={filingOk ? "ok" : undefined}
              >
                {filingOk && <CircleCheck size={14} aria-hidden="true" />}
                <span>{filingHelp(digits)}</span>
              </p>
            </Field>

            <div className={styles.pair}>
              <Select
                ref={practiceAreaRef}
                label="Especialidad (opcional)"
                name="especialidad"
                value={practiceArea}
                options={PRACTICE_AREA_OPTIONS}
                error={errors.practiceArea}
                onChange={(event) => {
                  setPracticeArea(event.target.value as PracticeArea | "");
                  clearError("practiceArea");
                }}
              />
              <Field
                ref={referenceRef}
                label="Referencia interna (opcional)"
                name="referencia"
                autoComplete="off"
                spellCheck={false}
                maxLength={REFERENCE_MAX_LENGTH}
                value={internalReference}
                error={errors.internalReference}
                describedBy={referenceHelpId}
                onChange={(event) => {
                  setInternalReference(event.target.value);
                  clearError("internalReference");
                }}
              >
                <p id={referenceHelpId} className={styles.help}>
                  Su código, por ejemplo RA-2026-031.
                </p>
              </Field>
            </div>

            <Field
              ref={courtRef}
              label="Despacho (opcional)"
              name="despacho"
              autoComplete="off"
              maxLength={COURT_MAX_LENGTH}
              value={court}
              error={errors.court}
              describedBy={courtHelpId}
              onChange={(event) => {
                setCourt(event.target.value);
                clearError("court");
              }}
            >
              <p id={courtHelpId} className={styles.help}>
                Por ejemplo, Juzgado 3 Laboral del Circuito de Bogotá.
              </p>
            </Field>

            <p className={styles.privacy}>
              <ShieldAlert size={18} aria-hidden="true" />
              <span>
                No escriba aquí datos sensibles ni más nombres de los
                necesarios: estos campos los ve todo el equipo del caso. La
                evidencia que suba irá cifrada con la llave propia del caso.
              </span>
            </p>

            {failure && (
              <Notice tone="error" ref={failureRef}>
                {failure.kind === "message" ? (
                  <p>{failure.text}</p>
                ) : (
                  <SystemError requestId={failure.requestId} />
                )}
              </Notice>
            )}

            <div className={styles.actions}>
              <p className={styles.note}>
                Usted quedará como miembro del caso.
              </p>
              <div className={styles.buttons}>
                <ButtonLink
                  to={ROUTES.app}
                  variant="secondary"
                  surface="dark"
                  size="sm"
                  shape="pill"
                >
                  Cancelar
                </ButtonLink>
                <Button
                  type="submit"
                  variant="bright"
                  size="sm"
                  shape="pill"
                  busy={create.isPending}
                >
                  {create.isPending ? "Abriendo el caso…" : "Abrir caso"}
                </Button>
              </div>
            </div>
          </form>
        </div>

        <div className={styles.previewPanel}>
          <OpeningRecordPreview
            title={title.trim()}
            filingNumber={filingValid ? digits : undefined}
            internalReference={internalReference.trim() || undefined}
            practiceArea={
              practiceArea ? PRACTICE_AREA_LABELS[practiceArea] : undefined
            }
            court={court.trim() || undefined}
            openedBy={openedBy}
            organization={me.organization?.name ?? ""}
            ready={ready}
          />
        </div>
      </div>

      <Dialog
        open={verifying}
        onClose={() => setVerifying(false)}
        title="Verifique su correo"
        icon={<MailCheck size={22} />}
        actions={
          <Button
            surface="dark"
            variant="secondary"
            size="sm"
            shape="pill"
            onClick={() => setVerifying(false)}
          >
            Cerrar
          </Button>
        }
      >
        <p>{`${CASE_MESSAGES.emailNotVerified}.`}</p>
        <ResendVerification />
      </Dialog>
    </>
  );
}
