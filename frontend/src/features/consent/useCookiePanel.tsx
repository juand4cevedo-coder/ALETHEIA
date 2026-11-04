import { useRef, useState } from "react";

import { CookiePanel } from "./CookiePanel.tsx";
import { useCookieChoice } from "./useCookieChoice.ts";

// Panel de cookies de cualquier marco del sitio. Aparece solo mientras no haya una elección
// guardada (primera visita o versión nueva del consentimiento) y cuando el visitante lo abre
// desde el pie; al cerrarlo así, el foco vuelve al botón desde el que se abrió.
export function useCookiePanel() {
  const cookieChoice = useCookieChoice();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const openerRef = useRef<HTMLButtonElement>(null);

  function openPanel() {
    setNotice("");
    setOpen(true);
  }

  function closePanel(saved: boolean) {
    if (saved) setNotice("Guardamos su elección sobre las cookies.");
    if (open) {
      setOpen(false);
      openerRef.current?.focus();
    }
  }

  const panel = (
    <>
      {(open || cookieChoice === null) && (
        <CookiePanel
          // Abrirlo desde el pie reinicia el panel en la vista de configuración.
          key={open ? "pie" : "aviso"}
          choice={cookieChoice}
          openedByVisitor={open}
          onClose={closePanel}
        />
      )}
      <p role="status" className="visually-hidden">
        {notice}
      </p>
    </>
  );

  return { panel, openPanel, openerRef };
}
