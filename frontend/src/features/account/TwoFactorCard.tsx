import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import type { TwoFactorSetup } from "../../api/generated";
import {
  twoFactorDisableMutation,
  twoFactorEnableMutation,
  twoFactorRecoveryCodesMutation,
  twoFactorSetupMutation,
  twoFactorStatusOptions,
  twoFactorStatusQueryKey,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import styles from "./TwoFactorCard.module.css";

type Mode = "idle" | "setup" | "codes" | "disable" | "renew";

// El secreto en grupos de cuatro: se lee y se teclea sin perder el lugar.
function grouped(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

function download(codes: readonly string[]) {
  const text = [
    "ALETHEIA: códigos de respaldo del segundo factor",
    "Cada código sirve una sola vez. Guárdelos en un lugar seguro.",
    "",
    ...codes,
    "",
  ].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "aletheia-codigos-de-respaldo.txt";
  link.click();
  URL.revokeObjectURL(url);
}

// Verificación en dos pasos: una aplicación de autenticación genera un código cada 30 segundos.
// Activarlo, desactivarlo y renovar los códigos de respaldo piden un código vigente, para que una
// sesión robada no baste para quitar la protección.
export function TwoFactorCard({
  onCodesSaved,
}: {
  /** Se llama cuando la persona confirma que guardó sus códigos de respaldo. */
  onCodesSaved?: () => void;
} = {}) {
  const queryClient = useQueryClient();
  const status = useQuery(twoFactorStatusOptions());
  const [mode, setMode] = useState<Mode>("idle");
  const [setup, setSetup] = useState<TwoFactorSetup>();
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: twoFactorStatusQueryKey(),
    });
  }

  function fail(failure: unknown) {
    const { status: http, detail } = apiProblem(failure);
    setError(
      http === 429
        ? "Demasiados intentos. Espere unos minutos."
        : (detail ?? "No pudimos completar la acción."),
    );
  }

  const start = useMutation({
    ...twoFactorSetupMutation(),
    onSuccess: (data) => {
      setSetup(data);
      setCode("");
      setError(undefined);
      setMode("setup");
    },
    onError: fail,
  });
  const enable = useMutation({
    ...twoFactorEnableMutation(),
    onSuccess: async (data) => {
      setCodes(data.recovery_codes);
      setCode("");
      setSetup(undefined);
      setMode("codes");
      await refresh();
    },
    onError: fail,
  });
  const renew = useMutation({
    ...twoFactorRecoveryCodesMutation(),
    onSuccess: async (data) => {
      setCodes(data.recovery_codes);
      setCode("");
      setMode("codes");
      await refresh();
    },
    onError: fail,
  });
  const disable = useMutation({
    ...twoFactorDisableMutation(),
    onSuccess: async () => {
      setCode("");
      setMode("idle");
      await refresh();
    },
    onError: fail,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const body = { code: code.trim() };
    if (body.code.length < 6) {
      setError("Escriba el código de 6 dígitos de su aplicación.");
      return;
    }
    if (mode === "setup") enable.mutate({ body });
    else if (mode === "renew") renew.mutate({ body });
    else if (mode === "disable") disable.mutate({ body });
  }

  const busy = enable.isPending || renew.isPending || disable.isPending;
  const enabled = status.data?.enabled === true;

  return (
    <Panel
      title="Verificación en dos pasos"
      description="Además de su contraseña, pida un código de una aplicación de autenticación. Protege su cuenta aunque alguien conozca su contraseña."
    >
      {status.isPending && <p role="status">Cargando el estado</p>}
      {status.isError && (
        <Notice tone="error">
          <p>No pudimos consultar el estado de la verificación en dos pasos.</p>
        </Notice>
      )}

      {status.data && mode === "idle" && (
        <div className={styles.block}>
          {enabled ? (
            <>
              <Notice tone="success">
                <p>
                  La verificación en dos pasos está activa. Le quedan{" "}
                  {status.data.recovery_codes_remaining} códigos de respaldo.
                </p>
              </Notice>
              {status.data.recovery_codes_remaining <= 3 && (
                <Notice tone="warning">
                  <p>
                    Le quedan pocos códigos de respaldo. Genere unos nuevos para
                    no quedarse sin acceso si pierde su teléfono.
                  </p>
                </Notice>
              )}
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError(undefined);
                    setCode("");
                    setMode("renew");
                  }}
                >
                  Generar códigos de respaldo nuevos
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setError(undefined);
                    setCode("");
                    setMode("disable");
                  }}
                >
                  Desactivar
                </Button>
              </div>
            </>
          ) : (
            <Button busy={start.isPending} onClick={() => start.mutate({})}>
              Activar la verificación en dos pasos
            </Button>
          )}
          {error && (
            <Notice tone="error">
              <p role="alert">{error}</p>
            </Notice>
          )}
        </div>
      )}

      {mode === "setup" && setup && (
        <form className={styles.block} onSubmit={submit} noValidate>
          <ol className={styles.steps}>
            <li>
              Instale una aplicación de autenticación (Google Authenticator,
              Microsoft Authenticator, Authy o 1Password).
            </li>
            <li>
              Agregue una cuenta nueva con esta clave. Desde el teléfono puede
              tocar{" "}
              <a href={setup.uri}>abrir en mi aplicación de autenticación</a>.
              <code
                className={styles.secret}
                aria-label="Clave de configuración"
              >
                {grouped(setup.secret)}
              </code>
            </li>
            <li>Escriba el código de 6 dígitos que muestra la aplicación.</li>
          </ol>
          <Field
            label="Código de la aplicación"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={12}
            value={code}
            error={error}
            onChange={(event) => setCode(event.target.value)}
          />
          <div className={styles.actions}>
            <Button type="submit" busy={busy}>
              Confirmar y activar
            </Button>
            <Button variant="secondary" onClick={() => setMode("idle")}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {(mode === "disable" || mode === "renew") && (
        <form className={styles.block} onSubmit={submit} noValidate>
          <p>
            {mode === "disable"
              ? "Para desactivarla, escriba un código vigente de su aplicación o uno de respaldo."
              : "Escriba un código vigente de su aplicación o uno de respaldo. Los códigos anteriores dejarán de valer."}
          </p>
          <Field
            label="Código"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={32}
            value={code}
            error={error}
            onChange={(event) => setCode(event.target.value)}
          />
          <div className={styles.actions}>
            <Button type="submit" busy={busy}>
              {mode === "disable" ? "Desactivar" : "Generar códigos nuevos"}
            </Button>
            <Button variant="secondary" onClick={() => setMode("idle")}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {mode === "codes" && (
        <div className={styles.block}>
          <Notice tone="warning">
            <p>
              Guarde estos códigos ahora: no se vuelven a mostrar. Cada uno
              sirve una sola vez si pierde el acceso a su aplicación.
            </p>
          </Notice>
          <ul className={styles.codes} aria-label="Códigos de respaldo">
            {codes.map((item) => (
              <li key={item}>
                <code>{item}</code>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => download(codes)}>
              Descargar como archivo
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void navigator.clipboard?.writeText(codes.join("\n"))
              }
            >
              Copiar
            </Button>
            <Button
              onClick={() => {
                setCodes([]);
                setMode("idle");
                onCodesSaved?.();
              }}
            >
              Ya los guardé
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
