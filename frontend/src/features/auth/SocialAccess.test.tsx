import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SocialAccess } from "./SocialAccess.tsx";

function googleStatus(enabled: boolean) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ enabled }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SocialAccess", () => {
  it("con Google configurado, el ingreso es un enlace activo con la G a color", async () => {
    googleStatus(true);
    const { container } = render(<SocialAccess />);

    const link = await screen.findByRole("link", {
      name: "Continuar con Google",
    });
    expect(link).toHaveAttribute("href", "/api/v1/auth/google/login");
    expect(
      screen.getByText(
        "Si ese correo todavía no tiene cuenta, lo llevamos a crearla con Google.",
      ),
    ).toBeInTheDocument();
    const fills = [...container.querySelectorAll("svg path")].map((path) =>
      path.getAttribute("fill"),
    );
    expect(fills).toEqual(["#EA4335", "#4285F4", "#FBBC05", "#34A853"]);
  });

  it("en el registro, el botón envía el formulario y no queda deshabilitado", async () => {
    googleStatus(true);
    render(<SocialAccess mode="register" />);

    const button = await screen.findByRole("button", {
      name: "Crear cuenta con Google",
    });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeEnabled();
  });

  it("sin configuración, el botón queda deshabilitado y lo explica", async () => {
    googleStatus(false);
    render(<SocialAccess />);

    expect(
      await screen.findByText(
        "El acceso con Google estará disponible cuando termine su configuración.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar con Google" }),
    ).toBeDisabled();
  });
});
