import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import {
  acceptPortalNoticeMutation,
  renewPortalLinkMutation,
  sendPortalMessageMutation,
  viewPortalMutation,
} from "../api/generated/@tanstack/react-query.gen.ts";
import type { PortalView } from "../api/generated/index.ts";
import { Button } from "../components/ui/Button.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { CirculoVistoIcon, VinculoIcon } from "../components/ui/icons.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { legalRoute } from "../config/routes.ts";
import { CONTACT_EMAIL, pageTitle } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import styles from "../features/auth/AccessScreen.module.css";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { tokenFromHash } from "../features/auth/linkToken.ts";
import portal from "./ClientPortalPage.module.css";

const TITLE_ID = "titulo-portal-cliente";

type Problem =
  | { kind: "gone" }
  | { kind: "tooManyAttempts" }
  | { kind: "system"; requestId?: string };

function colombianDate(value: string): string {
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

// Portal del cliente (ADR-054). El cliente llega con el enlace de su correo, sin cuenta. Antes de
// ver su caso acepta un aviso sobre sus datos; después ve el título, el estado y los avisos que
// el despacho le publicó. El token se queda en la dirección (el navegador nunca envía el
// fragmento al servidor) para que recargar la página no lo bote del portal.
export function ClientPortalPage() {
  const location = useLocation();
  const [token] = useState(() => tokenFromHash(location.hash));
  const [data, setData] = useState<PortalView | null>(null);
  const [problem, setProblem] = useState<Problem | null>(
    token ? null : { kind: "gone" },
  );
  const headingRef = useRef<HTMLHeadingElement>(null);

  function fail(failure: unknown) {
    const { status, requestId } = apiProblem(failure);
    if (status === 404) setProblem({ kind: "gone" });
    else if (status === 429) setProblem({ kind: "tooManyAttempts" });
    else setProblem({ kind: "system", requestId });
  }

  const view = useMutation({
    ...viewPortalMutation(),
    onSuccess: (result) => {
      setProblem(null);
      setData(result);
    },
    onError: fail,
  });
  const accept = useMutation({
    ...acceptPortalNoticeMutation(),
    onSuccess: () => {
      if (token) view.mutate({ body: { token } });
    },
    onError: fail,
  });

  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const send = useMutation({
    ...sendPortalMessageMutation(),
    onSuccess: () => {
      setText("");
      setSendError("");
      if (token) view.mutate({ body: { token } });
    },
    onError: (failure) => {
      const { status, requestId } = apiProblem(failure);
      if (status === 404) setProblem({ kind: "gone" });
      else if (status === 429)
        setSendError(
          "Envió muchos mensajes seguidos. Espere unos minutos para escribir otro.",
        );
      else if (status === 409) setSendError("Este caso ya no recibe mensajes.");
      else setProblem({ kind: "system", requestId });
    },
  });

  const renew = useMutation({
    ...renewPortalLinkMutation(),
    onError: fail,
  });

  const { mutate: load } = view;
  useEffect(() => {
    if (token) load({ body: { token } });
  }, [token, load]);

  const stage =
    problem?.kind ??
    (data ? (data.notice_accepted ? "view" : "notice") : "loading");
  useEffect(() => {
    if (stage !== "loading") headingRef.current?.focus();
  }, [stage]);

  return (
    <>
      <title>{pageTitle("Su espacio del caso")}</title>
      <meta name="robots" content="noindex" />

      <div className={styles.screen}>
        {problem?.kind === "gone" && (
          <section className={styles.notice} aria-labelledby={TITLE_ID}>
            <VinculoIcon size={20} aria-hidden="true" />
            <h1
              id={TITLE_ID}
              className={styles.noticeTitle}
              ref={headingRef}
              tabIndex={-1}
            >
              Este enlace ya no sirve
            </h1>
            <p>
              Venció, el despacho lo reemplazó con uno nuevo o le quitó el
              acceso.
            </p>
            {token && !renew.isSuccess && (
              <>
                <p>
                  Si el acceso sigue vigente, le enviamos un enlace nuevo al
                  correo con que lo invitaron.
                </p>
                <Button
                  type="button"
                  busy={renew.isPending}
                  onClick={() => {
                    if (!renew.isPending) renew.mutate({ body: { token } });
                  }}
                >
                  {renew.isPending ? "Enviando" : "Pedir un enlace nuevo"}
                </Button>
              </>
            )}
            {renew.isSuccess && (
              <p role="status">
                Si el acceso sigue vigente, enviamos un enlace nuevo al correo
                con que lo invitaron. Revise también la carpeta de spam.
              </p>
            )}
            {!token && (
              <p>Pídale al despacho que le envíe el enlace otra vez.</p>
            )}
          </section>
        )}

        {problem?.kind === "tooManyAttempts" && (
          <div className={styles.alert} role="alert">
            <p>{MESSAGES.tooManyAttempts}</p>
          </div>
        )}
        {problem?.kind === "system" && (
          <div className={styles.alert} role="alert">
            <SystemError requestId={problem.requestId} />
          </div>
        )}

        {!problem && !data && <p role="status">Abriendo su espacio</p>}

        {!problem && data && !data.notice_accepted && (
          <>
            <header className={styles.intro}>
              <h1
                id={TITLE_ID}
                className={styles.title}
                ref={headingRef}
                tabIndex={-1}
              >
                Hola, {data.client_name}
              </h1>
              <p className={styles.lead}>
                {data.organization_name} le abrió este espacio para que siga su
                caso. Antes de entrar, lea cómo cuidamos sus datos.
              </p>
            </header>
            <div className={portal.notice}>
              <h2>Aviso sobre sus datos personales</h2>
              <p>
                {data.organization_name} y ALETHEIA son corresponsables del
                tratamiento de sus datos en este espacio, conforme a la Ley 1581
                de 2012.
              </p>
              <p>
                Usamos su nombre, su correo y la información de su caso que el
                despacho decida compartirle, solo para que usted pueda seguirlo.
                No la usamos para publicidad ni la entregamos a terceros ajenos
                al servicio.
              </p>
              <p>
                Usted puede conocer, actualizar o corregir sus datos y pedir que
                se supriman, escribiendo al despacho o a{" "}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Más
                detalles en la{" "}
                <Link to={legalRoute("privacidad")}>
                  política de privacidad
                </Link>
                .
              </p>
            </div>
            <div className={styles.submit}>
              <Button
                type="button"
                block
                busy={accept.isPending}
                onClick={() => {
                  if (token && !accept.isPending)
                    accept.mutate({ body: { token } });
                }}
              >
                {accept.isPending ? "Guardando" : "Entiendo y quiero entrar"}
              </Button>
            </div>
          </>
        )}

        {!problem && data?.notice_accepted && (
          <>
            <header className={styles.intro}>
              <h1
                id={TITLE_ID}
                className={styles.title}
                ref={headingRef}
                tabIndex={-1}
              >
                {data.case_title}
              </h1>
              <p className={styles.lead}>
                <CirculoVistoIcon size={16} aria-hidden="true" /> Caso{" "}
                {data.case_status === "open" ? "abierto" : "archivado"} en{" "}
                {data.organization_name}.
              </p>
            </header>
            {data.updates.length === 0 ? (
              <p className={portal.empty}>
                El despacho todavía no le ha publicado avisos. Cuando lo haga,
                los verá aquí.
              </p>
            ) : (
              <ol className={portal.updates} aria-label="Avisos del despacho">
                {data.updates.map((item) => (
                  <li key={item.id} className={portal.update}>
                    <header>
                      <strong>{item.author_name}</strong>
                      <time dateTime={item.created_at}>
                        {colombianDate(item.created_at)}
                      </time>
                    </header>
                    <p>{item.body}</p>
                  </li>
                ))}
              </ol>
            )}
            <section
              className={portal.messages}
              aria-labelledby="mensajes-del-cliente"
            >
              <h2 id="mensajes-del-cliente">Escribirle al despacho</h2>
              {data.case_status === "open" ? (
                <form
                  className={portal.messageForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = text.trim();
                    if (token && body && !send.isPending)
                      send.mutate({ body: { token, body } });
                  }}
                >
                  <Field
                    label="Su mensaje"
                    multiline
                    rows={4}
                    maxLength={2000}
                    value={text}
                    help="El despacho lo lee en el caso. No es una consulta urgente: para eso llame."
                    disabled={send.isPending}
                    onChange={(event) => setText(event.target.value)}
                  />
                  <Button
                    type="submit"
                    busy={send.isPending}
                    disabled={text.trim() === ""}
                  >
                    Enviar mensaje
                  </Button>
                  {sendError && (
                    <Notice tone="error">
                      <p role="alert">{sendError}</p>
                    </Notice>
                  )}
                </form>
              ) : (
                <p className={portal.empty}>
                  El caso está archivado y ya no recibe mensajes.
                </p>
              )}
              {data.messages.length > 0 && (
                <ol className={portal.updates} aria-label="Sus mensajes">
                  {data.messages.map((item) => (
                    <li key={item.id} className={portal.update}>
                      <header>
                        <strong>Usted</strong>
                        <time dateTime={item.created_at}>
                          {colombianDate(item.created_at)}
                        </time>
                      </header>
                      <p>{item.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <p className={portal.foot}>
              Este enlace es personal y vale hasta el{" "}
              {colombianDate(data.expires_at)} (hora de Colombia). No lo
              reenvíe.
            </p>
          </>
        )}
      </div>
    </>
  );
}
