import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";

import {
  cancelPaymentSourceMutation,
  confirmPaymentSourceMutation,
  readPaymentSourceOptions,
  readPaymentSourceQueryKey,
  startPaymentSourceMutation,
  wompiTermsOptions,
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

// Renovación automática (ADR-058): el responsable vincula su Nequi para que el plan se renueve
// solo. Aquí se lee el texto exacto de la autorización, se aprueba en el celular y se cancela con
// un clic. Solo aparece cuando el servidor tiene la función encendida.
export function RenewalCard() {
  const queryClient = useQueryClient();
  const info = useQuery({ ...readPaymentSourceOptions() });
  const source = info.data?.source ?? null;
  const pending = source?.status === "pending";
  const terms = useQuery({
    ...wompiTermsOptions(),
    enabled: info.data?.enabled === true && (source === null || pending),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: readPaymentSourceQueryKey() });
  const start = useMutation({
    ...startPaymentSourceMutation(),
    onSuccess: () => void refresh(),
  });
  const confirm = useMutation({
    ...confirmPaymentSourceMutation(),
    onSuccess: () => void refresh(),
  });
  const cancel = useMutation({
    ...cancelPaymentSourceMutation(),
    onSuccess: () => void refresh(),
  });
  const { mutate: confirmNow } = confirm;
  const [polls, setPolls] = useState(0);
  const termsData = terms.data;

  // Mientras la persona aprueba en su celular, se vuelve a preguntar hasta que termine.
  useEffect(() => {
    if (!pending || !termsData) return;
    if (polls >= MAX_POLLS) return;
    const timer = window.setTimeout(() => {
      setPolls((count) => count + 1);
      confirmNow({
        body: {
          acceptance_token: termsData.acceptance_token,
          accept_personal_auth: termsData.accept_personal_auth,
        },
      });
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [pending, termsData, polls, confirmNow]);

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
          timedOut={polls >= MAX_POLLS}
          busy={confirm.isPending}
          onCheck={() => {
            setPolls(0);
            if (termsData)
              confirmNow({
                body: {
                  acceptance_token: termsData.acceptance_token,
                  accept_personal_auth: termsData.accept_personal_auth,
                },
              });
          }}
          onCancel={() => cancel.mutate({})}
        />
      ) : (
        <LinkForm
          consentText={info.data.consent_text}
          consentVersion={info.data.consent_version}
          declined={source?.status === "declined"}
          busy={start.isPending}
          onSubmit={(phone) =>
            start.mutate({
              body: {
                phone_number: phone,
                consent_version: info.data.consent_version,
                accept_consent: true,
              },
            })
          }
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
  timedOut,
  busy,
  onCheck,
  onCancel,
}: {
  timedOut: boolean;
  busy: boolean;
  onCheck: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <Notice tone="info">
        <p role="status">
          Abra la notificación de Nequi en su celular y apruebe la vinculación.
          Esta página se actualiza sola.
        </p>
      </Notice>
      {timedOut && (
        <p>
          Todavía no vemos la aprobación. Si ya aprobó en Nequi, pulse
          verificar.
        </p>
      )}
      <div>
        <Button variant="secondary" size="sm" busy={busy} onClick={onCheck}>
          Ya aprobé, verificar
        </Button>{" "}
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
  declined,
  busy,
  onSubmit,
}: {
  consentText: string;
  consentVersion: string;
  declined: boolean;
  busy: boolean;
  onSubmit: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
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
    setError(undefined);
    onSubmit(phone);
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
