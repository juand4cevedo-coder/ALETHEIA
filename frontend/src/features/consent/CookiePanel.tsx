import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
// abierto. En la primera visita es una barra baja con el aviso y los dos botones, para no tapar
// la página en un teléfono; abierto desde el pie, muestra las categorías y el foco entra al
// panel. Cerrarlo sin elegir (Escape o la equis) cuenta como rechazo (RF-004).
export function CookiePanel({
  choice,
  openedByVisitor,
  onClose,
}: CookiePanelProps) {
  const [view, setView] = useState<"summary" | "settings">(
    openedByVisitor ? "settings" : "summary",
  );
  const [analytics, setAnalytics] = useState(choice?.analytics ?? false);
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const movedByVisitor = useRef(openedByVisitor);

  useEffect(() => {
    // El foco entra al panel cuando el visitante lo pidió: al abrirlo o al pasar a configurar.
    if (movedByVisitor.current) titleRef.current?.focus();
  }, [view]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const property = "--cookie-bar-height";
    const root = document.documentElement.style;
    const measure = () => root.setProperty(property, `${panel.offsetHeight}px`);
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(panel);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      root.removeProperty(property);
    };
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
      ref={panelRef}
      className={styles.panel}
      data-view={view}
      aria-labelledby="cookies-titulo"
      onKeyDown={handleKeyDown}
    >
      {view === "summary" ? (
        <>
          <div className={styles.summary}>
            <p
              id="cookies-titulo"
              ref={titleRef}
              tabIndex={-1}
              className="visually-hidden"
            >
              Cookies en ALETHEIA
            </p>
            <p className={styles.text}>
              Usamos las cookies necesarias para su sesión. Medir de forma
              anónima la velocidad del sitio es opcional.{" "}
              <Link to={legalRoute("cookies")}>Política de cookies</Link>
              {" o "}
              <button
                type="button"
                className={styles.configure}
                onClick={openSettings}
              >
                Elegir por categoría
              </button>
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={choiceButton}
              onClick={() => decide(false)}
            >
              Rechazar
            </button>
            <button
              type="button"
              className={choiceButton}
              onClick={() => decide(true)}
            >
              Aceptar
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.head}>
            <p
              id="cookies-titulo"
              ref={titleRef}
              tabIndex={-1}
              className={styles.title}
            >
              <GalletaIcon size={16} />
              Cookies en ALETHEIA
            </p>
            <button
              type="button"
              className={styles.close}
              aria-label="Cerrar"
              onClick={dismiss}
            >
              <CerrarIcon size={16} />
            </button>
          </div>
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
                  Mide de forma anónima qué tan rápido carga y responde el
                  sitio, para corregir lo que vaya lento. No usa cookies y la
                  medida no queda ligada a su cuenta ni a su navegador. Si la
                  deja apagada, el sitio funciona igual.
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
