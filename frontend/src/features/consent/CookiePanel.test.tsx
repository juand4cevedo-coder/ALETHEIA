import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { legalRoute } from "../../config/routes.ts";
import { seriousAxeViolations } from "../../test/axe.ts";
import { renderRoute } from "../../test/render.tsx";
import {
  CONSENT_VERSION,
  COOKIE_CHOICE_KEY,
  hasCookieConsent,
} from "./cookieConsent.ts";

// Las pruebas abren la política de cookies: el marco público es el mismo en todas las páginas
// y esta no llama a la API.
const PAGE = legalRoute("cookies");

function storedChoice(): unknown {
  const raw = window.localStorage.getItem(COOKIE_CHOICE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

function rememberChoice(analytics: boolean, version = CONSENT_VERSION) {
  window.localStorage.setItem(
    COOKIE_CHOICE_KEY,
    JSON.stringify({
      version,
      decidedAt: "2026-11-02T15:00:00.000Z",
      analytics,
    }),
  );
}

function cookiePanel() {
  return screen.queryByRole("region", { name: "Cookies en ALETHEIA" });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>());
});

describe("Panel de cookies (HU-004, CP-004)", () => {
  it("en la primera visita avisa sin instalar ninguna cookie ni quitar el foco (CA-HU-004-01)", async () => {
    const { container } = renderRoute(PAGE);

    const panel = cookiePanel();
    expect(panel).toBeInTheDocument();
    expect(
      within(panel!).getByRole("button", { name: "Rechazar opcionales" }),
    ).toBeVisible();
    expect(
      within(panel!).getByRole("button", { name: "Aceptar opcionales" }),
    ).toBeVisible();
    expect(document.activeElement).toBe(document.body);
    expect(document.cookie).toBe("");
    expect(storedChoice()).toBeNull();
    expect(hasCookieConsent("analytics")).toBe(false);
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("recuerda el rechazo en la siguiente visita sin instalar cookies (CA-HU-004-02)", async () => {
    const user = userEvent.setup();
    const { unmount } = renderRoute(PAGE);

    await user.click(
      screen.getByRole("button", { name: "Rechazar opcionales" }),
    );

    expect(cookiePanel()).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Guardamos su elección sobre las cookies.",
    );
    expect(storedChoice()).toMatchObject({
      version: CONSENT_VERSION,
      analytics: false,
    });
    expect(document.cookie).toBe("");
    expect(hasCookieConsent("analytics")).toBe(false);

    unmount();
    renderRoute(PAGE);
    expect(cookiePanel()).not.toBeInTheDocument();
  });

  it("acepta las opcionales con el mismo peso visual que el rechazo", async () => {
    const user = userEvent.setup();
    renderRoute(PAGE);

    const reject = screen.getByRole("button", { name: "Rechazar opcionales" });
    const accept = screen.getByRole("button", { name: "Aceptar opcionales" });
    expect(accept.className).toBe(reject.className);

    await user.click(accept);
    expect(cookiePanel()).not.toBeInTheDocument();
    expect(hasCookieConsent("analytics")).toBe(true);
  });

  it("configura cada categoría con las necesarias siempre activas", async () => {
    const user = userEvent.setup();
    renderRoute(PAGE);

    await user.click(screen.getByRole("button", { name: "Configurar" }));

    const panel = cookiePanel()!;
    expect(within(panel).getByText("Cookies en ALETHEIA")).toHaveFocus();
    expect(within(panel).getByText("Siempre activas")).toBeVisible();
    const analytics = within(panel).getByRole("switch", { name: "Analítica" });
    expect(analytics).not.toBeChecked();

    await user.click(analytics);
    await user.click(
      within(panel).getByRole("button", { name: "Guardar mi elección" }),
    );
    expect(cookiePanel()).not.toBeInTheDocument();
    expect(hasCookieConsent("analytics")).toBe(true);
  });

  it("se reabre desde el pie para cambiar la elección y devuelve el foco (CA-HU-004-02)", async () => {
    rememberChoice(true);
    const user = userEvent.setup();
    const { container } = renderRoute(PAGE);
    expect(cookiePanel()).not.toBeInTheDocument();

    const footerButton = screen.getByRole("button", {
      name: "Configurar cookies",
    });
    await user.click(footerButton);

    const panel = cookiePanel()!;
    expect(within(panel).getByText("Cookies en ALETHEIA")).toHaveFocus();
    const analytics = within(panel).getByRole("switch", { name: "Analítica" });
    expect(analytics).toBeChecked();
    expect(await seriousAxeViolations(container)).toEqual([]);

    await user.click(analytics);
    await user.click(
      within(panel).getByRole("button", { name: "Guardar mi elección" }),
    );
    expect(cookiePanel()).not.toBeInTheDocument();
    expect(footerButton).toHaveFocus();
    expect(hasCookieConsent("analytics")).toBe(false);

    // Escape cierra sin cambiar lo guardado.
    await user.click(footerButton);
    await user.keyboard("{Escape}");
    expect(cookiePanel()).not.toBeInTheDocument();
    expect(footerButton).toHaveFocus();
    expect(storedChoice()).toMatchObject({ analytics: false });
  });

  it("cerrar el aviso sin elegir cuenta como rechazo", async () => {
    const user = userEvent.setup();
    renderRoute(PAGE);

    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(cookiePanel()).not.toBeInTheDocument();
    expect(storedChoice()).toMatchObject({ analytics: false });
  });

  it("vuelve a preguntar si la elección es de una versión anterior del consentimiento", () => {
    rememberChoice(true, CONSENT_VERSION - 1);
    renderRoute(PAGE);

    expect(cookiePanel()).toBeInTheDocument();
    expect(hasCookieConsent("analytics")).toBe(false);
  });

  it("si el navegador bloquea el almacenamiento, la elección dura mientras la página siga abierta", async () => {
    const blocked = () => {
      throw new DOMException("Bloqueado", "SecurityError");
    };
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(blocked);
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(blocked);
    const user = userEvent.setup();
    renderRoute(PAGE);

    await user.click(
      screen.getByRole("button", { name: "Rechazar opcionales" }),
    );
    expect(cookiePanel()).not.toBeInTheDocument();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
