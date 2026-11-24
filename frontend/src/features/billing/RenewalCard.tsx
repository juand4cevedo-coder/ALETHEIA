import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";

import type { WompiTermsOut } from "../../api/generated";
import {
  cancelPaymentSourceMutation,
  confirmPaymentSourceMutation,
  readPaymentSourceOptions,
  readPaymentSourceQueryKey,
  startPaymentSourceMutation,
  wompiTermsOptions,
  wompiTermsQueryKey,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Checkbox } from "../../components/ui/Checkbox.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { SystemError } from "../../components/ui/SystemError.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import { formatColombiaTime } from "../cases/dates.ts";

const PHONE_PATTERN = /^3\d{9}$/;
const POLL_MS = 5_000;
const MAX_POLLS = 24;

type Acceptance = { acceptance_token: string; accept_personal_auth: string };

// Renovación automática (ADR-058): el responsable vincula su Nequi para que el plan se renueve
// solo. Aquí se lee el texto exacto de la autorización, se aceptan los contratos de Wompi, se
// aprueba en el celular y se cancela con un clic. Solo aparece cuando el servidor tiene la
// función encendida.
//
// Los dos tokens de aceptación de Wompi sirven una sola vez y representan que la persona leyó y
// aceptó sus contratos: se piden de nuevo siempre que un intento falla o la página se recarga.
export function RenewalCard() {
  const queryClient = useQueryClient();
  const info = useQuery({ ...readPaymentSourceOptions() });
  const source = info.data?.source ?? null;
  const pending = source?.status === "pending";
  const terms = useQuery({
    ...wompiTermsOptions(),
    enabled: info.data?.enabled === true && (source === null || pending),
    // Cada token vale una sola vez: no se reutiliza lo que quedó en caché.
    staleTime: 0,
    gcTime: 0,
  });
  const [acceptance, setAcceptance] = useState<Acceptance | null>(null);
  const [polls, setPolls] = useState(0);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: readPaymentSourceQueryKey() });
  const forgetAcceptance = () => {
    setAcceptance(null);
    void queryClient.invalidateQueries({ queryKey: wompiTermsQueryKey() });
  };
  const start = useMutation({
    ...startPaymentSourceMutation(),
    onSuccess: () => {
      setPolls(0);
      void refresh();
    },
    onError: forgetAcceptance,
  });
  const confirm = useMutation({
    ...confirmPaymentSourceMutation(),
    onSuccess: (result) => {
      void refresh();
      // Mientras siga pendiente se sigue preguntando con los mismos tokens; si quedó creada o
      // declinada, el token ya se gastó.
      if (result.status !== "pending") setAcceptance(null);
    },
    onError: forgetAcceptance,
  });
  const cancel = useMutation({
    ...cancelPaymentSourceMutation(),
    onSuccess: () => {
      setAcceptance(null);
      void refresh();
    },
  });
  const { mutate: confirmNow } = confirm;

  // Mientras la persona aprueba en su celular, se vuelve a preguntar hasta que termine. Solo
  // cuando ya aceptó los contratos de Wompi: sin sus tokens no se puede crear la fuente.
  useEffect(() => {
    if (!pending || !acceptance || polls >= MAX_POLLS) return;
    const timer = window.setTimeout(() => {
      setPolls((count) => count + 1);
      confirmNow({ body: acceptance });
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [pending, acceptance, polls, confirmNow]);

  if (!info.data?.enabled) return null;

  const failure = [start, confirm, cancel].find((mutation) => mutation.isError);
  const problem = failure?.error ? apiProblem(failure.error) : null;

  return (
    <Panel
      title="Renovación automática"
      description="Renueve su plan sin tener que acordarse: se cobra a su Nequi al vencer cada periodo, y se lo avisamos siete días antes."
    >
      {source?.status === "active" ? (
        <Active
          last4={source.phone_last4}
          since={source.linked_at}
          busy={cancel.isPending}
          onCancel={() => cancel.mutate({})}
        />
      ) : pending ? (
        <Pending
          waiting={acceptance !== null}
          timedOut={polls >= MAX_POLLS}
          busy={confirm.isPending}
          terms={terms.data}
          onAccept={(accepted) => {
            setPolls(0);
            setAcceptance(accepted);
          }}
          onCheck={() => {
            setPolls(0);
            if (acceptance) confirmNow({ body: acceptance });
          }}
          onCancel={() => cancel.mutate({})}
        />
      ) : (
        <LinkForm
          consentText={info.data.consent_text}
          consentVersion={info.data.consent_version}
          terms={terms.data}
          declined={source?.status === "declined"}
          busy={start.isPending}
          onSubmit={(phone, accepted) => {
            setAcceptance(accepted);
            start.mutate({
              body: {
                phone_number: phone,
                consent_version: info.data.consent_version,
                accept_consent: true,
              },
            });
          }}
        />
      )}
      {problem && (
        <Notice tone="error">
          {problem.status && problem.status < 500 && problem.detail ? (
            <p role="alert">{problem.detail}</p>
          ) : (
            <SystemError requestId={problem.requestId} />
          )}
        </Notice>
      )}
    </Panel>
  );
}

function WompiAcceptance({
  terms,
  onChange,
}: {
  terms: WompiTermsOut | undefined;
  onChange: (accepted: Acceptance | null) => void;
}) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedData, setAcceptedData] = useState(false);

  function report(nextTerms: boolean, nextData: boolean) {
    onChange(
      terms && nextTerms && nextData
        ? {
            acceptance_token: terms.acceptance_token,
            accept_personal_auth: terms.accept_personal_auth,
          }
        : null,
    );
  }

  if (!terms) return <p role="status">Cargando los contratos de Wompi</p>;
  return (
    <>
      <Checkbox
        checked={acceptedTerms}
        onChange={(event) => {
          setAcceptedTerms(event.target.checked);
          report(event.target.checked, acceptedData);
        }}
      >
        Acepto los{" "}
        <a href={terms.acceptance_permalink} target="_blank" rel="noreferrer">
          términos de uso de Wompi
        </a>
        .
      </Checkbox>
      <Checkbox
        checked={acceptedData}
        onChange={(event) => {
          setAcceptedData(event.target.checked);
          report(acceptedTerms, event.target.checked);
        }}
      >
        Autorizo el{" "}
        <a
          href={terms.personal_auth_permalink}
          target="_blank"
          rel="noreferrer"
        >
          tratamiento de mis datos personales
        </a>{" "}
        por Wompi.
      </Checkbox>
    </>
  );
}

function Active({
  last4,
  since,
  busy,
  onCancel,
}: {
  last4: string | null;
  since: string | null;
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <div>
      <Notice tone="success">
        <p role="status">
          La renovación automática está activa con el Nequi que termina en{" "}
          <strong translate="no">{last4}</strong>
          {since ? `, desde el ${formatColombiaTime(since).split(",")[0]}` : ""}
          .
        </p>
      </Notice>
      <p>
        Puede cancelarla cuando quiera: deja de cobrarse al instante y, si
        quiere, vuelve a pagar a mano.
      </p>
      <Button variant="secondary" size="sm" busy={busy} onClick={onCancel}>
        Cancelar la renovación automática
      </Button>
    </div>
  );
}

function Pending({
  waiting,
  timedOut,
  busy,
  terms,
  onAccept,
  onCheck,
  onCancel,
}: {
  waiting: boolean;
  timedOut: boolean;
  busy: boolean;
  terms: WompiTermsOut | undefined;
  onAccept: (accepted: Acceptance) => void;
  onCheck: () => void;
  onCancel: () => void;
}) {
  const [accepted, setAccepted] = useState<Acceptance | null>(null);
  return (
    <div>
      <Notice tone="info">
        <p role="status">
          Abra la notificación de Nequi en su celular y apruebe la vinculación.
          {waiting ? " Esta página se actualiza sola." : ""}
        </p>
      </Notice>
      {!waiting && (
        <>
          <p>
            Para terminar, acepte de nuevo los contratos de Wompi. Cada
            aceptación sirve una sola vez.
          </p>
          <WompiAcceptance
            key={terms?.acceptance_token}
            terms={terms}
            onChange={setAccepted}
          />
          <Button
            size="sm"
            disabled={
              accepted === null ||
              accepted.acceptance_token !== terms?.acceptance_token
            }
            onClick={() => accepted && onAccept(accepted)}
          >
            Continuar
          </Button>{" "}
        </>
      )}
      {waiting && timedOut && (
        <p>
          Todavía no vemos la aprobación. Si ya aprobó en Nequi, pulse
          verificar.
        </p>
      )}
      <div>
        {waiting && (
          <>
            <Button variant="secondary" size="sm" busy={busy} onClick={onCheck}>
              Ya aprobé, verificar
            </Button>{" "}
          </>
        )}
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancelar la vinculación
        </Button>
      </div>
    </div>
  );
}

function LinkForm({
  consentText,
  consentVersion,
  terms,
  declined,
  busy,
  onSubmit,
}: {
  consentText: string;
  consentVersion: string;
  terms: WompiTermsOut | undefined;
  declined: boolean;
  busy: boolean;
  onSubmit: (phone: string, accepted: Acceptance) => void;
}) {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [accepted, setAccepted] = useState<Acceptance | null>(null);
  const [error, setError] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!PHONE_PATTERN.test(phone)) {
      setError("Escriba un celular colombiano, como 3001234567.");
      return;
    }
    if (!consent) {
      setError("Marque la autorización para continuar.");
      return;
    }
    if (!accepted || accepted.acceptance_token !== terms?.acceptance_token) {
      setError("Acepte los dos contratos de Wompi para continuar.");
      return;
    }
    setError(undefined);
    onSubmit(phone, accepted);
  }

  return (
    <form noValidate onSubmit={submit} data-consent-version={consentVersion}>
      {declined && (
        <Notice tone="warning">
          <p role="alert">
            La vinculación no se aprobó en Nequi. Puede intentarlo de nuevo.
          </p>
        </Notice>
      )}
      <Field
        label="Celular Nequi"
        name="celular-renovacion"
        inputMode="numeric"
        autoComplete="tel-national"
        required
        help="A este número le llega la notificación para aprobar la vinculación."
        value={phone}
        onChange={(event) => setPhone(event.target.value.trim())}
      />
      <Checkbox
        checked={consent}
        onChange={(event) => setConsent(event.target.checked)}
      >
        {consentText}
      </Checkbox>
      <WompiAcceptance
        key={terms?.acceptance_token}
        terms={terms}
        onChange={setAccepted}
      />
      {error && (
        <Notice tone="error">
          <p role="alert">{error}</p>
        </Notice>
      )}
      <Button type="submit" busy={busy}>
        Vincular mi Nequi
      </Button>
    </form>
  );
}
