import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { previewInvitation } from "../api/generated";
import {
  acceptInvitationMutation,
  readMeQueryKey,
} from "../api/generated/@tanstack/react-query.gen.ts";
import type { InvitationPreview } from "../api/generated";
import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { LEGAL_VERSION } from "../config/legal.ts";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import styles from "../features/auth/AccessScreen.module.css";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { LegalConsent } from "../features/auth/LegalConsent.tsx";
import { tokenFromHash } from "../features/auth/linkToken.ts";
import { newPasswordError } from "../features/auth/newPassword.ts";
import { PasswordMeter } from "../features/auth/PasswordMeter.tsx";
import {
  PASSWORD_MAX_LENGTH,
  SIGN_UP_MESSAGES,
} from "../features/auth/signUp.ts";
import { dateTime } from "../features/members/format.ts";
import { rememberSession } from "../features/session/sessionHint.ts";
import { ROLE_LABELS } from "../features/workspace/roles.ts";
import { UsuariosIcon, VinculoIcon } from "../components/ui/icons.tsx";

const TITLE_ID = "titulo-invitacion";
const METER_ID = "medidor-invitacion";

type Values = { fullName: string; password: string; accepts: boolean };
type Errors = Partial<Record<keyof Values, string>>;
type Failure =
  { kind: "message"; text: string } | { kind: "system"; requestId?: string };

const EMPTY: Values = { fullName: "", password: "", accepts: false };

// Aceptar una invitación (UI-011, HU-012, API-052 y API-019). El token sale de la dirección
// apenas se lee. La pantalla muestra a qué organización y con qué rol entra la persona: si su
// correo no tiene cuenta, la crea con nombre y contraseña; si la tiene, confirma con su
// contraseña. Al aceptar entra directo a su espacio de trabajo.
export function AcceptInvitationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => tokenFromHash(location.hash));

  useEffect(() => {
    if (location.hash) void navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  const invitation = useQuery({
    queryKey: ["invitationPreview", token],
    queryFn: async ({ signal }) => {
      const { data } = await previewInvitation({
        body: { token: token ?? "" },
        signal,
        throwOnError: true,
      });
      return data;
    },
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  const status = invitation.isError
    ? apiProblem(invitation.error).status
    : undefined;

  return (
    <>
      <title>{pageTitle("Aceptar la invitación")}</title>
      <meta name="robots" content="noindex" />

      <div className={styles.screen}>
        {token === null || status === 400 ? (
          <Unusable />
        ) : invitation.isPending ? (
          <header className={styles.intro}>
            <p className={styles.lead} role="status">
              Abriendo su invitación
            </p>
          </header>
        ) : invitation.isError ? (
          <Notice tone="error">
            {status === 429 ? (
              <p>{MESSAGES.tooManyAttempts}</p>
            ) : (
              <SystemError requestId={apiProblem(invitation.error).requestId} />
            )}
          </Notice>
        ) : invitation.data.account === "member_elsewhere" ? (
          <MemberElsewhere invitation={invitation.data} />
        ) : (
          <AcceptForm token={token} invitation={invitation.data} />
        )}
      </div>
    </>
  );
}

function Intro({ invitation }: { invitation: InvitationPreview }) {
  return (
    <header className={styles.intro}>
      <h1 id={TITLE_ID} className={styles.title}>
        Únase a {invitation.organization_name}
      </h1>
      <p className={styles.lead}>
        {invitation.inviter_name} le envió una invitación para entrar con el rol
        de <strong>{ROLE_LABELS[invitation.role]}</strong>. Vence el{" "}
        {dateTime(invitation.expires_at)}
      </p>
    </header>
  );
}

function AcceptForm({
  token,
  invitation,
}: {
  token: string;
  invitation: InvitationPreview;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = invitation.account === "new";
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [unusable, setUnusable] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const acceptsRef = useRef<HTMLInputElement>(null);

  const accept = useMutation({
    ...acceptInvitationMutation(),
    onSuccess: async () => {
      setValues(EMPTY);
      rememberSession();
      await queryClient.invalidateQueries({ queryKey: readMeQueryKey() });
      await navigate(ROUTES.app, { replace: true });
    },
    onError: (error) => {
      const { status, detail, requestId } = apiProblem(error);
      if (status === 400 && detail?.startsWith("Esta invitación")) {
        setUnusable(true);
        return;
      }
      if (status === 401) {
        setValues((current) => ({ ...current, password: "" }));
        setErrors({ password: detail });
        passwordRef.current?.focus();
        return;
      }
      if (status === 429) {
        setFailure({ kind: "message", text: MESSAGES.tooManyAttempts });
        return;
      }
      if ((status === 409 || status === 400) && detail) {
        setFailure({ kind: "message", text: detail });
        return;
      }
      setFailure({ kind: "system", requestId });
    },
  });

  if (unusable) return <Unusable />;

  function validate(): Errors {
    if (!isNew) {
      return values.password ? {} : { password: "Escriba su contraseña." };
    }
    return {
      fullName: values.fullName.trim() ? undefined : SIGN_UP_MESSAGES.fullName,
      password: newPasswordError(values.password),
      accepts: values.accepts ? undefined : SIGN_UP_MESSAGES.acceptsLegalTerms,
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accept.isPending) return;
    setFailure(null);
    const found = validate();
    setErrors(found);
    if (found.fullName) return nameRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    if (found.accepts) return acceptsRef.current?.focus();
    accept.mutate({
      body: isNew
        ? {
            token,
            full_name: values.fullName.trim(),
            password: values.password,
            legal_version: LEGAL_VERSION,
            accepts_legal_terms: true,
          }
        : { token, password: values.password },
    });
  }

  return (
    <>
      <Intro invitation={invitation} />
      <form
        className={styles.form}
        noValidate
        onSubmit={handleSubmit}
        aria-labelledby={TITLE_ID}
      >
        {failure && (
          <Notice tone="error">
            {failure.kind === "message" ? (
              <p>{failure.text}</p>
            ) : (
              <SystemError requestId={failure.requestId} />
            )}
          </Notice>
        )}

        <p className={styles.lead}>
          {isNew
            ? "Cree su cuenta para entrar. Ingresará siempre con este correo:"
            : "Ya tiene una cuenta con este correo. Confirme con su contraseña:"}{" "}
          <strong translate="no">{invitation.email}</strong>
        </p>

        <fieldset className={styles.fields}>
          <legend className="visually-hidden">Datos de su cuenta</legend>
          {isNew && (
            <Field
              ref={nameRef}
              label="Nombre completo"
              name="nombre"
              autoComplete="name"
              required
              maxLength={120}
              value={values.fullName}
              error={errors.fullName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  fullName: event.target.value,
                }))
              }
            />
          )}
          <Field
            ref={passwordRef}
            label={isNew ? "Contraseña nueva" : "Contraseña"}
            name="contrasena"
            type="password"
            autoComplete={isNew ? "new-password" : "current-password"}
            required
            maxLength={PASSWORD_MAX_LENGTH}
            value={values.password}
            error={errors.password}
            describedBy={isNew ? METER_ID : undefined}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          >
            {isNew && (
              <PasswordMeter id={METER_ID} password={values.password} />
            )}
          </Field>
        </fieldset>

        {isNew ? (
          <div className={styles.terms}>
            <LegalConsent
              ref={acceptsRef}
              checked={values.accepts}
              error={errors.accepts}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  accepts: event.target.checked,
                }))
              }
            />
          </div>
        ) : (
          <Link to={ROUTES.forgotPassword} className={styles.forgot}>
            ¿Olvidó su contraseña?
          </Link>
        )}

        <div className={styles.submit}>
          <Button type="submit" block busy={accept.isPending}>
            {accept.isPending
              ? "Ingresando"
              : isNew
                ? "Crear mi cuenta y entrar"
                : "Aceptar la invitación"}
          </Button>
        </div>
      </form>
    </>
  );
}

function MemberElsewhere({ invitation }: { invitation: InvitationPreview }) {
  return (
    <section className={styles.notice} aria-labelledby={TITLE_ID}>
      <UsuariosIcon size={28} aria-hidden="true" />
      <h1 id={TITLE_ID} className={styles.noticeTitle}>
        Su correo ya está en otra organización
      </h1>
      <p>
        <strong translate="no">{invitation.email}</strong> ya pertenece a una
        organización en ALETHEIA. Por ahora, cada persona puede estar en una
        sola organización. Por eso no puede unirse a{" "}
        {invitation.organization_name}.
      </p>
      <ButtonLink to={ROUTES.signIn}>Ingresar a mi cuenta</ButtonLink>
    </section>
  );
}

function Unusable() {
  return (
    <section className={styles.notice} aria-labelledby={TITLE_ID}>
      <VinculoIcon size={28} aria-hidden="true" />
      <h1 id={TITLE_ID} className={styles.noticeTitle}>
        Esta invitación ya no sirve
      </h1>
      <p>
        Las invitaciones vencen a las 72 horas y sirven una sola vez. Es posible
        que ya la haya aceptado o que la hayan revocado. Pida una nueva a quien
        le envió la invitación.
      </p>
      <ButtonLink to={ROUTES.signIn}>Ingresar</ButtonLink>
    </section>
  );
}
