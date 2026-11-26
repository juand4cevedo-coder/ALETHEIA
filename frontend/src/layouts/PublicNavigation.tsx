import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router";
import { ChevronAbajoIcon } from "../components/ui/icons.tsx";
import { NAVIGATION } from "../config/navigation.ts";
import { ROUTES } from "../config/routes.ts";
import styles from "./PublicNavigation.module.css";

const loadPanel = () => import("./NavigationPanelContent.tsx");
const NavigationPanelContent = lazy(loadPanel);

/** Un solo panel evita saltos al recorrer las categorías con el puntero. */
export function PublicNavigation() {
  const [active, setActive] = useState<number | null>(null);
  // Opción bajo el puntero: el indicador la sigue aunque ningún panel esté abierto.
  const [hovered, setHovered] = useState<number | null>(null);
  const pinned = useRef<number | null>(null);
  const root = useRef<HTMLElement>(null);
  const triggers = useRef<(HTMLElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const group = active === null ? null : NAVIGATION[active]!;
  function cancelClose() {
    clearTimeout(closeTimer.current);
  }
  function close() {
    cancelClose();
    pinned.current = null;
    setActive(null);
  }

  // El indicador se desliza hasta la opción abierta o la que está bajo el puntero; al salir se
  // queda donde estaba y se desvanece, para que el siguiente movimiento parta de ahí.
  const target = active ?? hovered;
  useLayoutEffect(() => {
    const trigger = target === null ? null : triggers.current[target];
    if (trigger)
      setIndicator({ left: trigger.offsetLeft, width: trigger.offsetWidth });
  }, [target]);

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        close();
    }
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", dismiss);
      clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <nav
      ref={root}
      className={styles.nav}
      aria-label="Principal"
      onPointerEnter={() => {
        cancelClose();
        void loadPanel();
      }}
      onFocusCapture={() => void loadPanel()}
      onPointerLeave={(event) => {
        if (
          event.pointerType === "mouse" &&
          pinned.current === null &&
          !root.current
            ?.querySelector("#navigation-panel")
            ?.contains(document.activeElement)
        )
          closeTimer.current = setTimeout(close, 160);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && active !== null) {
          event.preventDefault();
          triggers.current[active]?.focus();
          close();
        }
      }}
    >
      <span
        className={styles.indicator}
        aria-hidden="true"
        data-visible={target !== null}
        style={
          indicator
            ? {
                width: indicator.width,
                transform: `translateX(${indicator.left}px)`,
              }
            : undefined
        }
      />
      <ul className={styles.list} onPointerLeave={() => setHovered(null)}>
        {NAVIGATION.map((item, index) => (
          <li key={item.title}>
            <button
              type="button"
              ref={(node) => {
                triggers.current[index] = node;
              }}
              id={`nav-trigger-${index}`}
              aria-expanded={active === index}
              aria-controls={active === index ? "navigation-panel" : undefined}
              onPointerEnter={(event) => {
                setHovered(index);
                if (event.pointerType === "mouse") {
                  cancelClose();
                  if (active !== index) pinned.current = null;
                  setActive(index);
                }
              }}
              onClick={() => {
                cancelClose();
                if (pinned.current === index) close();
                else {
                  pinned.current = index;
                  setActive(index);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  const next =
                    (index +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      NAVIGATION.length) %
                    NAVIGATION.length;
                  triggers.current[next]?.focus();
                  if (active !== null) {
                    pinned.current = next;
                    setActive(next);
                  }
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  pinned.current = index;
                  setActive(index);
                  requestAnimationFrame(() =>
                    root.current
                      ?.querySelector<HTMLAnchorElement>(
                        `#navigation-panel .${styles.links} a`,
                      )
                      ?.focus(),
                  );
                }
              }}
            >
              {item.title}
              <ChevronAbajoIcon size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
        <li>
          <NavLink
            to={ROUTES.pricing}
            ref={(node) => {
              triggers.current[NAVIGATION.length] = node;
            }}
            onPointerEnter={() => {
              close();
              setHovered(NAVIGATION.length);
            }}
          >
            Precios
          </NavLink>
        </li>
      </ul>
      {group &&
        // Fuera del encabezado: su filtro de desenfoque haría de contenedor del velo y lo dejaría
        // sin alto. En el cuerpo de la página cubre toda la ventana, por debajo del encabezado.
        createPortal(
          <div className={styles.scrim} aria-hidden="true" />,
          document.body,
        )}
      {group && (
        <div
          id="navigation-panel"
          className={styles.panel}
          aria-labelledby={`nav-trigger-${active}`}
        >
          <Suspense fallback={null}>
            <NavigationPanelContent group={group} close={close} />
          </Suspense>
        </div>
      )}
    </nav>
  );
}
