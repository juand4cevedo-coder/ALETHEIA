import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, NavLink } from "react-router";
import {
  ChevronAbajoIcon,
  FlechaDerechaIcon,
} from "../components/ui/icons.tsx";
import { IconTile } from "../components/ui/IconTile.tsx";
import { NAVIGATION } from "../config/navigation.ts";
import { ROUTES } from "../config/routes.ts";
import styles from "./PublicNavigation.module.css";

/** Un solo panel evita saltos al recorrer las categorías con el puntero. */
export function PublicNavigation() {
  const [active, setActive] = useState<number | null>(null);
  const pinned = useRef<number | null>(null);
  const root = useRef<HTMLElement>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
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

  // El indicador se desliza hasta la opción abierta; al cerrar se queda donde estaba y se
  // desvanece, para que el siguiente movimiento parta de ahí y no desde el borde.
  useLayoutEffect(() => {
    const trigger = active === null ? null : triggers.current[active];
    if (trigger)
      setIndicator({ left: trigger.offsetLeft, width: trigger.offsetWidth });
  }, [active]);

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
      onPointerEnter={cancelClose}
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
        data-visible={active !== null}
        style={
          indicator
            ? {
                width: indicator.width,
                transform: `translateX(${indicator.left}px)`,
              }
            : undefined
        }
      />
      <ul className={styles.list}>
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
          <NavLink to={ROUTES.pricing} onPointerEnter={close}>
            Precios
          </NavLink>
        </li>
      </ul>
      {group && <div className={styles.scrim} aria-hidden="true" />}
      {group && (
        <div
          id="navigation-panel"
          className={styles.panel}
          aria-labelledby={`nav-trigger-${active}`}
        >
          <div className={styles.panelContent} key={group.title}>
            <Link
              to={group.feature.to}
              className={styles.feature}
              onClick={close}
            >
              <IconTile icon={group.feature.icon} tone="solid" size="lg" />
              <span className={styles.featureTitle}>{group.feature.title}</span>
              <small>{group.feature.text}</small>
              <span className={styles.featureCta}>
                Conocer más
                <FlechaDerechaIcon size={14} aria-hidden="true" />
              </span>
            </Link>
            <div className={styles.links}>
              {group.links.map((link, position) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={close}
                  style={{ "--i": position } as CSSProperties}
                >
                  <span>
                    {link.label}
                    <FlechaDerechaIcon size={14} aria-hidden="true" />
                  </span>
                  {link.description && <small>{link.description}</small>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
