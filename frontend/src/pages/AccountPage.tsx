import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { Link, useLocation, useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import { changePasswordMutation } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { newPasswordError } from "../features/auth/newPassword.ts";
import { PasswordMeter } from "../features/auth/PasswordMeter.tsx";
import { SocialAccess } from "../features/auth/SocialAccess.tsx";
import { PASSWORD_MAX_LENGTH } from "../features/auth/signUp.ts";
import { CloseAccountDialog } from "../features/account/CloseAccountDialog.tsx";
import { EmailStatus } from "../features/session/EmailStatus.tsx";
import { SignOutEverywhereDialog } from "../features/session/SignOutEverywhereDialog.tsx";
import { useSignOut } from "../features/session/useSignOut.ts";
import { TwoFactorCard } from "../features/account/TwoFactorCard.tsx";
import styles from "./AccountPage.module.css";

const METER_ID = "medidor-cambio";
const EMPTY = { current: "", next: "" };

// Los mismos textos que responde la API (API-013).
const WRONG_CURRENT =
  "La contraseña actual no coincide. Revísela e inténtelo de nuevo.";
const SAME_PASSWORD = "La contraseña nueva debe ser distinta de la actual.";

type Errors = { current?: string; next?: string };
type Failure =
  { kind: "tooManyAttempts" } | { kind: "system"; requestId?: string };

// Mi cuenta (UI-020, HU-009 y HU-010): el perfil con el que se ingresa, el cambio de
// contraseña con la actual y el cierre de esta sesión o de todas. Al cambiar la contraseña, la
// API cierra las sesiones de los demás dispositivos y conserva esta.
export function AccountPage() {
  const me = useOutletContext<Me>();
  const googleResult = new URLSearchParams(useLocation().search).get("google");

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Mi cuenta")}</title>
      <meta name="robots" content="noindex" />

      <PageHeader title="Mi cuenta" />

      <Panel title="Perfil">
        <dl className={styles.record}>
          <div className={styles.row}>
            <dt>Nombre</dt>
            <dd>{me.full_name}</dd>
          </div>
          <div className={styles.row}>
            <dt>Correo</dt>
            <dd className={styles.email}>
              <span translate="no">{me.email}</span>
              <EmailStatus verified={me.email_verified} />
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Método de ingreso</dt>
            <dd>Correo y contraseña</dd>
          </div>
        </dl>
      </Panel>

      {me.subscription && (
        <Panel title="Plan del despacho">
          <dl className={styles.record}>
            <div className={styles.row}>
              <dt>Plan</dt>
              <dd>{me.subscription.plan_name}</dd>
            </div>
            <div className={styles.row}>
              <dt>Estado</dt>
              <dd>
                {me.subscription.status === "active"
                  ? "Activo"
                  : me.subscription.status === "trial"
                    ? "Prueba"
                    : "Solo lectura"}
              </dd>
            </div>
            <div className={styles.row}>
              <dt>Vencimiento</dt>
              <dd>
                {me.subscription.ends_at
                  ? new Date(me.subscription.ends_at).toLocaleString("es-CO")
                  : "Sin fecha definida"}
              </dd>
            </div>
          </dl>
          <p>
            <Link to={ROUTES.billing}>Ver el plan, pagar o cambiarlo</Link>
          </p>
        </Panel>
      )}

      <Panel
        title="Acceso con Google"
        description="Vincule su identidad de forma explícita. ALETHEIA nunca une cuentas solo porque tengan el mismo correo."
      >
        {googleResult === "vinculado" && (
          <Notice tone="success">Google quedó vinculado a su cuenta.</Notice>
        )}
        {googleResult === "ocupado" && (
          <Notice tone="error">
            Esa identidad de Google ya pertenece a otra cuenta de ALETHEIA.
          </Notice>
        )}
        <SocialAccess mode="link" linked={me.google_linked} />
      </Panel>

      <PasswordCard />
      <TwoFactorCard />
      <SessionsCard />
      <AccountClosureCard me={me} />
    </div>
  );
}

function AccountClosureCard({ me }: { me: Me }) {
  const [confirming, setConfirming] = useState(false);
  const closesOrganization = me.organization?.role === "owner";

  return (
    <Panel
      title="Cierre de cuenta"
      description="Revoca su acceso y elimina su identidad directa sin destruir la trazabilidad que deba conservarse."
    >
      {me.platform_admin ? (
        <Notice tone="info">
          La cuenta dueña de la plataforma no puede cerrarse desde aquí. Antes
          debe transferirse esa responsabilidad para evitar dejar la operación
          sin administración.
        </Notice>
      ) : (
        <>
          <p className={styles.closureCopy}>
            Esta acción es definitiva. Los expedientes y registros sujetos a
            conservación legal o contractual permanecen seudonimizados y
            protegidos.
          </p>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Cerrar mi cuenta
          </Button>
          <CloseAccountDialog
            open={confirming}
            onClose={() => setConfirming(false)}
            closesOrganization={closesOrganization}
          />
        </>
      )}
    </Panel>
  );
}

function PasswordCard() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [changed, setChanged] = useState(false);
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);

  const change = useMutation({
    ...changePasswordMutation(),
    onSuccess: () => {
      // Ninguna de las dos contraseñas se queda en la memoria de la página.
      setValues(EMPTY);
      setChanged(true);
    },
    onError: (error) => {
      const { status, detail, requestId } = apiProblem(error);
      if (status === 400 && detail === SAME_PASSWORD) {
        setErrors({ next: SAME_PASSWORD });
        nextRef.current?.focus();
        return;
      }
      if (status === 400) {
        setErrors({ current: WRONG_CURRENT });
        setValues((current) => ({ ...current, current: "" }));
        currentRef.current?.focus();
        return;
      }
      setFailure(
        status === 429
          ? { kind: "tooManyAttempts" }
          : { kind: "system", requestId },
      );
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (change.isPending) return;
    setChanged(false);
    setFailure(null);
    const found: Errors = {
      current: values.current ? undefined : "Escriba su contraseña actual.",
      next:
        newPasswordError(values.next) ??
        (values.next.normalize("NFKC") === values.current.normalize("NFKC")
          ? SAME_PASSWORD
          : undefined),
    };
    setErrors(found);
    if (found.current) return currentRef.current?.focus();
    if (found.next) return nextRef.current?.focus();
    change.mutate({
      body: { current_password: values.current, new_password: values.next },
    });
  }

  return (
    <Panel
      title="Contraseña"
      description="Al cambiarla se cierran sus sesiones en otros dispositivos. En este puede seguir trabajando."
    >
      {changed && (
        <Notice tone="success">
          Su contraseña cambió. Le enviamos un aviso por correo.
        </Notice>
      )}
      {failure && (
        <Notice tone="error">
          {failure.kind === "tooManyAttempts" ? (
            <p>{MESSAGES.tooManyAttempts}</p>
          ) : (
            <SystemError requestId={failure.requestId} />
          )}
        </Notice>
      )}

      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <Field
          ref={currentRef}
          label="Contraseña actual"
          name="contrasena-actual"
          type="password"
          autoComplete="current-password"
          required
          value={values.current}
          error={errors.current}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              current: event.target.value,
            }))
          }
        />
        <Field
          ref={nextRef}
          label="Contraseña nueva"
          name="contrasena-nueva"
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={values.next}
          error={errors.next}
          describedBy={METER_ID}
          onChange={(event) =>
            setValues((current) => ({ ...current, next: event.target.value }))
          }
        >
          <PasswordMeter id={METER_ID} password={values.next} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" busy={change.isPending}>
            {change.isPending
              ? "Cambiando la contraseña"
              : "Cambiar la contraseña"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function SessionsCard() {
  const session = useSignOut();
  const [confirming, setConfirming] = useState(false);

  return (
    <Panel
      title="Sesiones"
      description="Si perdió un equipo o cree que alguien más entró a su cuenta, cierre todas las sesiones."
    >
      {session.failed && !confirming && (
        <Notice tone="error">
          No pudimos cerrar la sesión. Revise su conexión e inténtelo de nuevo.
        </Notice>
      )}
      <div className={styles.sessionActions}>
        <Button
          variant="secondary"
          busy={session.pending === "device"}
          disabled={session.pending !== null}
          onClick={session.signOut}
        >
          {session.pending === "device"
            ? "Cerrando la sesión"
            : "Cerrar esta sesión"}
        </Button>
        <Button
          variant="secondary"
          disabled={session.pending !== null}
          onClick={() => setConfirming(true)}
        >
          Cerrar todas las sesiones
        </Button>
      </div>
      <SignOutEverywhereDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={session.signOutEverywhere}
        busy={session.pending === "everywhere"}
        failed={session.failed}
      />
    </Panel>
  );
}
