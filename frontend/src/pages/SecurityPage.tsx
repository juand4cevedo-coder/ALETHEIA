import { useMutation } from "@tanstack/react-query";
import { CircleCheck, KeyRound } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import { changePasswordMutation } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { CONTACT_EMAIL, SITE_NAME } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { Field } from "../features/auth/Field.tsx";
import { newPasswordError } from "../features/auth/newPassword.ts";
import { PasswordMeter } from "../features/auth/PasswordMeter.tsx";
import { PASSWORD_MAX_LENGTH } from "../features/auth/signUp.ts";
import styles from "./SecurityPage.module.css";

const METER_ID = "medidor-cambio";
const EMPTY = { current: "", next: "" };

type Errors = { current?: string; next?: string };

// Los mismos textos que responde la API.
const WRONG_CURRENT =
  "La contraseña actual no coincide. Revísela e inténtelo de nuevo.";
const SAME_PASSWORD = "La contraseña nueva debe ser distinta de la actual.";

// Seguridad de la cuenta (HU-010, API-013): cambiar la contraseña con la actual. Al guardarla,
// la API cierra las sesiones de los demás dispositivos y conserva esta.
export function SecurityPage() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
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
      const { status, detail } = apiProblem(error);
      if (status === 400 && detail === SAME_PASSWORD) {
        setErrors({ next: detail });
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
          ? "Hizo varios intentos fallidos seguidos. Espere 15 minutos e inténtelo de nuevo."
          : `No pudimos cambiar la contraseña. Inténtelo de nuevo; si continúa, escríbanos a ${CONTACT_EMAIL}.`,
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
    <section className={styles.screen} aria-labelledby="titulo-seguridad">
      <title>{`Seguridad de la cuenta · ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />

      <header className={styles.intro}>
        <p className={styles.eyebrow}>Su cuenta</p>
        <h1 id="titulo-seguridad" className={styles.title}>
          Seguridad
        </h1>
      </header>

      <section className={styles.card} aria-labelledby="titulo-contrasena">
        <div className={styles.cardHead}>
          <span className={styles.cardIcon} aria-hidden="true">
            <KeyRound size={20} />
          </span>
          <div>
            <h2 id="titulo-contrasena" className={styles.cardTitle}>
              Cambiar la contraseña
            </h2>
            <p className={styles.cardText}>
              Al guardarla cerraremos la sesión en sus otros dispositivos; en
              este seguirá trabajando.
            </p>
          </div>
        </div>

        {changed && (
          <p className={styles.success} role="status">
            <CircleCheck size={18} aria-hidden="true" />
            Su contraseña cambió. Le enviamos un aviso por correo.
          </p>
        )}
        {failure && (
          <p className={styles.failure} role="alert">
            {failure}
          </p>
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
            <Button
              type="submit"
              variant="bright"
              shape="pill"
              busy={change.isPending}
            >
              {change.isPending ? "Guardando…" : "Cambiar la contraseña"}
            </Button>
          </div>
        </form>
      </section>

      <p className={styles.note}>
        ¿Perdió un equipo o cree que alguien más entró a su cuenta? Use{" "}
        <strong>Cerrar todas las sesiones</strong> en el menú de su cuenta,
        arriba a la derecha.
      </p>
    </section>
  );
}
