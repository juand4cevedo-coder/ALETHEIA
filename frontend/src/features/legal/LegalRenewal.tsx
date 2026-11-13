import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";

import type { Me } from "../../api/generated";
import {
  acceptLegalTermsMutation,
  readMeQueryKey,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Checkbox } from "../../components/ui/Checkbox.tsx";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION } from "../../config/legal.ts";
import {
  LEGAL_PAGES,
  legalRoute,
  type LegalSlug,
} from "../../config/routes.ts";
import logoUrl from "../../assets/simbolo.svg";
import { CONTACT_EMAIL, WORDMARK, pageTitle } from "../../config/site.ts";
import { useSignOut } from "../session/useSignOut.ts";
import { currentLegalChanges } from "./changes.ts";
import { formatEffectiveDate } from "./format.ts";
import styles from "./LegalRenewal.module.css";
import {
  BalanzaIcon,
  EscudoVistoIcon,
  FlechaDiagonalIcon,
  GalletaIcon,
  ReciboIcon,
  SalirIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";

const TITLE_ID = "titulo-textos-nuevos";
const CHANGES_ID = "titulo-cambios";

const POLICY_ICONS: Record<LegalSlug, IconComponent> = {
  privacidad: EscudoVistoIcon,
  terminos: BalanzaIcon,
  cookies: GalletaIcon,
  reembolsos: ReciboIcon,
};

type Problem =
  { kind: "changedMeanwhile" } | { kind: "unexpected"; requestId?: string };

function problemFrom(error: unknown): Problem {
  if (typeof error === "object" && error !== null && "status" in error) {
    if (error.status === 409) return { kind: "changedMeanwhile" };
    const requestId =
      "request_id" in error && typeof error.request_id === "string"
        ? error.request_id
        : undefined;
    return { kind: "unexpected", requestId };
  }
  return { kind: "unexpected" };
}

/**
 * Textos legales nuevos por aceptar (TT-012, RN-029). Ocupa el lugar del espacio de trabajo
 * mientras la persona no acepte la versión vigente: muestra qué cambió, deja abrir cada texto
 * completo y pide una aceptación expresa, con una casilla que nunca viene marcada (Ley 1480 de
 * 2011, art. 50, y Ley 1581 de 2012, art. 9). Quien no está de acuerdo sabe cómo cancelar.
 */
export function LegalRenewal({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [missing, setMissing] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [done, setDone] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const changes = currentLegalChanges();
  const firstName = me.full_name.trim().split(/\s+/)[0];

  // La pantalla reemplaza al espacio de trabajo: el foco va al título para que un lector de
  // pantalla anuncie de inmediato por qué cambió lo que había.
  useEffect(() => titleRef.current?.focus(), []);

  const accept = useMutation({
    ...acceptLegalTermsMutation(),
    onSuccess: async () => {
      setDone(true);
      await queryClient.invalidateQueries({ queryKey: readMeQueryKey() });
    },
    onError: (error) => {
      setProblem(problemFrom(error));
      requestAnimationFrame(() => alertRef.current?.focus());
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accept.isPending || done) return;
    setProblem(null);
    if (!accepted) {
      setMissing(true);
      checkboxRef.current?.focus();
      return;
    }
    accept.mutate({
      body: { legal_version: LEGAL_VERSION, accepts_legal_terms: true },
    });
  }

  return (
    <div className={styles.shell}>
      <title>{pageTitle("Textos legales actualizados")}</title>

      <header className={styles.header}>
        <p className={styles.brand}>
          <img src={logoUrl} alt="" width={24} height={24} />
          {WORDMARK}
        </p>
      </header>

      <main id="contenido" className={styles.main} tabIndex={-1}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>
            Vigentes desde el{" "}
            <time dateTime={LEGAL_EFFECTIVE_DATE}>{formatEffectiveDate()}</time>
          </p>
          <h1
            id={TITLE_ID}
            ref={titleRef}
            className={styles.title}
            tabIndex={-1}
          >
            Actualizamos nuestros textos legales
          </h1>
          <p className={styles.lead}>
            {firstName}, antes de seguir revise qué cambió y acepte la versión
            vigente. Su cuenta y sus casos siguen como estaban.
          </p>
        </header>

        {changes.length > 0 && (
          <section className={styles.panel} aria-labelledby={CHANGES_ID}>
            <h2 id={CHANGES_ID} className={styles.panelTitle}>
              Qué cambió
            </h2>
            <ol className={styles.changes}>
              {changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ol>
            <p className={styles.note}>
              Es un resumen; lo que rige es el texto completo de cada política.
            </p>
          </section>
        )}

        <nav aria-label="Textos completos" className={styles.documents}>
          {LEGAL_PAGES.map((page) => {
            const Icon = POLICY_ICONS[page.slug];
            return (
              <a
                key={page.slug}
                className={styles.document}
                href={legalRoute(page.slug)}
                target="_blank"
                rel="noopener"
              >
                <Icon size={16} aria-hidden="true" />
                <span>{page.label}</span>
                <FlechaDiagonalIcon
                  className={styles.documentArrow}
                  size={16}
                  aria-hidden="true"
                />
                <span className="visually-hidden">
                  {" "}
                  (se abre en otra pestaña)
                </span>
              </a>
            );
          })}
        </nav>

        <form
          className={styles.form}
          noValidate
          onSubmit={handleSubmit}
          aria-labelledby={TITLE_ID}
        >
          {problem && (
            <div
              ref={alertRef}
              className={styles.alert}
              role="alert"
              tabIndex={-1}
            >
              {problem.kind === "changedMeanwhile" ? (
                <>
                  <p>
                    Los textos cambiaron mientras los leía. Recargue la página
                    para ver la versión vigente.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.reload()}
                  >
                    Recargar la página
                  </Button>
                </>
              ) : (
                <p>
                  No pudimos registrar su aceptación. Inténtelo de nuevo. Si
                  vuelve a pasar, escríbanos a{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  {problem.requestId && (
                    <>
                      {" "}
                      con el código <code>{problem.requestId}</code>
                    </>
                  )}
                  .
                </p>
              )}
            </div>
          )}

          <div className={styles.consent}>
            <Checkbox
              ref={checkboxRef}
              name="acepta"
              required
              checked={accepted}
              error={
                missing && !accepted
                  ? "Marque la casilla para aceptar los textos vigentes."
                  : undefined
              }
              onChange={(event) => setAccepted(event.target.checked)}
            >
              Leí y acepto los términos y condiciones y la política de
              reembolsos, y autorizo el tratamiento de mis datos según la
              política de tratamiento de datos personales vigentes desde el{" "}
              {formatEffectiveDate()}.
            </Checkbox>
          </div>

          <Button type="submit" block busy={accept.isPending || done}>
            {done
              ? "Abriendo su espacio de trabajo"
              : accept.isPending
                ? "Registrando su aceptación"
                : "Aceptar los textos vigentes"}
          </Button>
        </form>

        <p className={styles.decline}>
          Si no está de acuerdo, no tiene que aceptar. Escríbanos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> y cancelamos
          su suscripción sin costo. Como dicen los términos, la cuenta queda 30
          días en solo lectura.
        </p>
        <SignOutLater />
      </main>
    </div>
  );
}

// Nadie queda atrapado en esta pantalla: la API deja cerrar la sesión sin aceptar (ADR-032).
function SignOutLater() {
  const session = useSignOut();
  return (
    <div className={styles.leave}>
      <button
        type="button"
        className={styles.leaveButton}
        onClick={session.signOut}
        disabled={session.pending !== null}
        aria-busy={session.pending === "device" || undefined}
      >
        <SalirIcon size={16} aria-hidden="true" />
        {session.pending === "device"
          ? "Cerrando la sesión"
          : "Cerrar la sesión y revisarlos después"}
      </button>
      {session.failed && (
        <p className={styles.leaveFailure} role="alert">
          No pudimos cerrar la sesión. Revise su conexión e inténtelo de nuevo.
        </p>
      )}
    </div>
  );
}
