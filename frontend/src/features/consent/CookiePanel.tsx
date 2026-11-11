import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { buttonClassName } from "../../components/ui/buttonStyles.ts";
import { legalRoute } from "../../config/routes.ts";
import { type CookieChoice, saveCookieChoice } from "./cookieConsent.ts";
import styles from "./CookiePanel.module.css";
import { CerrarIcon, GalletaIcon } from "../../components/ui/icons.tsx";

type CookiePanelProps = {
  /** La elección guardada, o null en la primera visita. */
  choice: CookieChoice | null;
  /** true si el visitante lo abrió desde el pie; false si aparece solo en la primera visita. */
  openedByVisitor: boolean;
  /** Se llama al cerrar; saved indica si se guardó una elección. */
  onClose: (saved: boolean) => void;
};

// Mismo peso visual para aceptar y rechazar (UI-004): ninguna opción se destaca sobre la otra.
const choiceButton = buttonClassName({
  variant: "secondary",
  size: "sm",
});

// Panel de cookies (UI-004, HU-004). No es modal: se puede seguir leyendo la página con él
// abierto. En la primera visita aparece sin quitarle el foco a nadie; abierto desde el pie, el
// foco entra al panel. Cerrarlo sin elegir cuenta como rechazo (RF-004).
export function CookiePanel({
  choice,
  openedByVisitor,
  onClose,
}: CookiePanelProps) {
  const [view, setView] = useState<"summary" | "settings">(
    openedByVisitor ? "settings" : "summary",
  );
  const [analytics, setAnalytics] = useState(choice?.analytics ?? false);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const movedByVisitor = useRef(openedByVisitor);

  useEffect(() => {
    // El foco entra al panel cuando el visitante lo pidió: al abrirlo o al pasar a configurar.
    if (movedByVisitor.current) titleRef.current?.focus();
  }, [view]);

  function decide(acceptAnalytics: boolean) {
    saveCookieChoice({ analytics: acceptAnalytics });
    onClose(true);
  }

  function dismiss() {
    if (choice === null) {
      decide(false);
      return;
    }
    onClose(false);
  }

  function openSettings() {
    movedByVisitor.current = true;
    setView("settings");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      dismiss();
    }
  }

  return (
    <section
      className={styles.panel}
      aria-labelledby="cookies-titulo"
      onKeyDown={handleKeyDown}
    >
      <div className={styles.head}>
        <p
          id="cookies-titulo"
          ref={titleRef}
          tabIndex={-1}
          className={styles.title}
        >
          <GalletaIcon size={18} />
          Cookies en ALETHEIA
        </p>
        <button
          type="button"
          className={styles.close}
          aria-label="Cerrar"
          onClick={dismiss}
        >
          <CerrarIcon size={18} />
        </button>
      </div>

      {view === "summary" ? (
        <>
          <p className={styles.text}>
            Solo usamos las cookies necesarias para mantener su sesión. No
            usamos analítica ni publicidad. Una cookie opcional queda apagada
            hasta que usted la acepte.{" "}
            <Link to={legalRoute("cookies")}>Política de cookies</Link>
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={choiceButton}
              onClick={() => decide(false)}
            >
              Rechazar opcionales
            </button>
            <button
              type="button"
              className={choiceButton}
              onClick={() => decide(true)}
            >
              Aceptar opcionales
            </button>
          </div>
          <button
            type="button"
            className={styles.configure}
            onClick={openSettings}
          >
            Elegir una por una
          </button>
        </>
      ) : (
        <>
          <ul className={styles.categories}>
            <li className={styles.category}>
              <div>
                <p className={styles.categoryName}>Necesarias</p>
                <p className={styles.categoryText}>
                  Mantienen su sesión abierta y protegen su cuenta. Sin ellas no
                  es posible ingresar.
                </p>
              </div>
              <span className={styles.always}>Siempre activas</span>
            </li>
            <li className={styles.category}>
              <div>
                <label
                  htmlFor="cookies-analitica"
                  className={styles.categoryName}
                >
                  Analítica
                </label>
                <p
                  id="cookies-analitica-detalle"
                  className={styles.categoryText}
                >
                  Medirían de forma anónima cómo se usa el sitio. Hoy no usamos
                  ninguna herramienta de este tipo, así que esta opción no
                  activa nada. Si algún día la agregamos, le volveremos a
                  preguntar.
                </p>
              </div>
              <input
                id="cookies-analitica"
                type="checkbox"
                role="switch"
                className={styles.switch}
                checked={analytics}
                aria-describedby="cookies-analitica-detalle"
                onChange={(event) => setAnalytics(event.target.checked)}
              />
            </li>
          </ul>
          <div className={styles.actions}>
            <button
              type="button"
              className={choiceButton}
              onClick={() => decide(false)}
            >
              Rechazar opcionales
            </button>
            <button
              type="button"
              className={choiceButton}
              onClick={() => decide(analytics)}
            >
              Guardar mi elección
            </button>
          </div>
        </>
      )}
    </section>
  );
}
