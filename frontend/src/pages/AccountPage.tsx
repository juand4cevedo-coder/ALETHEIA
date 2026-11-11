import { useMutation } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";
import { useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import { changePasswordMutation } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { SITE_NAME } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { newPasswordError } from "../features/auth/newPassword.ts";
import { PasswordMeter } from "../features/auth/PasswordMeter.tsx";
import { PASSWORD_MAX_LENGTH } from "../features/auth/signUp.ts";
import { SignOutEverywhereDialog } from "../features/session/SignOutEverywhereDialog.tsx";
import { useSignOut } from "../features/session/useSignOut.ts";
import styles from "./AccountPage.module.css";
import {
  CirculoAlertaIcon,
  CirculoVistoIcon,
  DispositivosIcon,
  LlaveIcon,
  UsuarioIcon,
} from "../components/ui/icons.tsx";

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

  return (
    <section className={styles.screen} aria-labelledby="titulo-cuenta">
      <title>{`Mi cuenta · ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />

      <header className={styles.intro}>
        <p className={styles.eyebrow}>Perfil y seguridad</p>
        <h1 id="titulo-cuenta" className={styles.title}>
          Mi cuenta
        </h1>
      </header>

      <Card
        icon={<UsuarioIcon size={20} />}
        title="Perfil"
        description="Los datos con los que ingresa a ALETHEIA."
      >
        <dl className={styles.record}>
          <div className={styles.row}>
            <dt>Nombre</dt>
            <dd>{me.full_name}</dd>
          </div>
          <div className={styles.row}>
            <dt>Correo</dt>
            <dd className={styles.email}>
              <span translate="no">{me.email}</span>
              {me.email_verified ? (
                <span className={styles.verified}>
                  <CirculoVistoIcon size={16} aria-hidden="true" />
                  Verificado
                </span>
              ) : (
                <span className={styles.pending}>
                  <CirculoAlertaIcon size={16} aria-hidden="true" />
                  Sin verificar
                </span>
              )}
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Método de ingreso</dt>
            <dd>Correo y contraseña</dd>
          </div>
        </dl>
      </Card>

      <PasswordCard />
      <SessionsCard />
    </section>
  );
}

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.cardHead}>
        <span className={styles.cardIcon} aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 id={titleId} className={styles.cardTitle}>
            {title}
          </h2>
          <p className={styles.cardText}>{description}</p>
        </div>
      </div>
      {children}
    </section>
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
    <Card
      icon={<LlaveIcon size={20} />}
      title="Contraseña"
      description="Al cambiarla cerraremos la sesión en sus otros dispositivos; en este seguirá trabajando."
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
            {change.isPending ? "Guardando…" : "Cambiar la contraseña"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SessionsCard() {
  const session = useSignOut();
  const [confirming, setConfirming] = useState(false);

  return (
    <Card
      icon={<DispositivosIcon size={20} />}
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
            ? "Cerrando sesión…"
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
    </Card>
  );
}
