import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BROWSER_STORAGE } from "../../config/browserStorage.ts";

const KEY = BROWSER_STORAGE.theme.key;

function mockSystem(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn((media: string) =>
      media.includes("prefers-color-scheme")
        ? query
        : { matches: false, addEventListener() {}, removeEventListener() {} },
    ),
  );
  return {
    flip(next: boolean) {
      query.matches = next;
      for (const listener of listeners) listener();
    },
  };
}

// El módulo lee la preferencia al cargarse: cada prueba lo importa de nuevo.
async function loadTheme() {
  vi.resetModules();
  return import("./theme.ts");
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("Modo de color", () => {
  it("sin elección sigue al sistema y cambia cuando el sistema cambia", async () => {
    const system = mockSystem(true);
    const { useTheme } = await loadTheme();
    function Probe() {
      const { preference, resolved } = useTheme();
      return <p>{`${preference}-${resolved}`}</p>;
    }
    render(<Probe />);
    expect(screen.getByText("system-dark")).toBeInTheDocument();
    act(() => system.flip(false));
    expect(screen.getByText("system-light")).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("recuerda la elección y la borra al volver a «Sistema»", async () => {
    mockSystem(false);
    const { setThemePreference } = await loadTheme();
    setThemePreference("dark");
    expect(window.localStorage.getItem(KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    setThemePreference("system");
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("ignora un valor guardado que no conoce", async () => {
    mockSystem(false);
    window.localStorage.setItem(KEY, "violeta");
    const { useTheme } = await loadTheme();
    function Probe() {
      return <p>{useTheme().preference}</p>;
    }
    render(<Probe />);
    expect(screen.getByText("system")).toBeInTheDocument();
  });

  it("el interruptor dice a qué modo lleva y lo aplica", async () => {
    mockSystem(false);
    await loadTheme();
    const { ThemeSwitch } = await import("./ThemeToggle.tsx");
    const user = userEvent.setup();
    render(<ThemeSwitch />);
    await user.click(
      screen.getByRole("button", { name: "Cambiar a modo oscuro" }),
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Cambiar a modo claro" }),
    ).toBeInTheDocument();
  });

  it("el selector de tres posiciones es un grupo de radios con nombre", async () => {
    mockSystem(false);
    await loadTheme();
    const { ThemeChooser } = await import("./ThemeChooser.tsx");
    const user = userEvent.setup();
    render(<ThemeChooser />);
    expect(screen.getByRole("group", { name: "Modo de color" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Sistema" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Oscuro" }));
    expect(screen.getByRole("radio", { name: "Oscuro" })).toBeChecked();
    expect(window.localStorage.getItem(KEY)).toBe("dark");
  });
});
