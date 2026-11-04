import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const ACCEPTED = {
  detail:
    "Si el correo puede usarse, le enviamos un enlace para verificarlo. Revise su bandeja de entrada y la carpeta de spam.",
};

function problem(status: number, extra: Record<string, unknown> = {}) {
  return jsonResponse(
    {
      type: "about:blank",
      title: "Error",
      status,
      instance: "/api/v1/auth/register",
      ...extra,
    },
    status,
  );
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  password = "una frase larga y fácil",
) {
  await user.type(screen.getByLabelText("Nombre completo"), "Ana Restrepo");
  await user.type(
    screen.getByLabelText("Oficina o firma"),
    "Restrepo Abogados",
  );
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "ana@example.com",
  );
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("checkbox"));
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Abrir la cuenta" }));
}

describe("Crear cuenta (HU-005, CP-005)", () => {
  it("tiene etiquetas visibles y no tiene errores graves de accesibilidad", async () => {
    const { container } = renderRoute("/registro");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Acta de apertura de cuenta",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute(
      "href",
      "/ingresar",
    );
    expect(
      screen.getByRole("button", { name: "Configurar cookies" }),
    ).toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("demuestra cuántos caracteres de la huella cambia una sola letra", async () => {
    const user = userEvent.setup();
    renderRoute("/registro");
    const huella = () =>
      screen
        .getByText(/^Huella actual: /)
        .textContent?.replace("Huella actual: ", "");

    await waitFor(() => expect(huella()).toMatch(/^[0-9a-f]{64}$/));
    const inicial = huella()!;
    await user.type(screen.getByLabelText("Nombre completo"), "A");

    await waitFor(() => expect(huella()).not.toBe(inicial));
    const final = huella()!;
    const cambiados = [...final].filter((c, i) => c !== inicial[i]).length;
    // El contador dice exactamente lo que cambió: la afirmación queda demostrada.
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent ===
            `Su último cambio movió ${cambiados} de los 64 caracteres.`,
      ),
    ).toBeInTheDocument();
  });

  it("guía la contraseña por su longitud, sin reglas de composición", async () => {
    const user = userEvent.setup();
    renderRoute("/registro");
    const contrasena = screen.getByLabelText("Contraseña");

    expect(contrasena).toHaveAccessibleDescription(
      "Al menos 12 caracteres. Una frase funciona bien.",
    );
    await user.type(contrasena, "aaaaaaaaaaaaaaaa");
    expect(contrasena).toHaveAccessibleDescription(
      "Use caracteres más variados.",
    );
    await user.clear(contrasena);
    await user.type(contrasena, "mi perro se llama Ron");
    expect(contrasena).toHaveAccessibleDescription("Muy buena contraseña.");
  });

  it("marca los campos vacíos, enfoca el primero y no llama a la API", async () => {
    const user = userEvent.setup();
    renderRoute("/registro");

    await submit(user);

    const nombre = screen.getByLabelText("Nombre completo");
    expect(nombre).toHaveFocus();
    expect(nombre).toHaveAttribute("aria-invalid", "true");
    expect(nombre).toHaveAccessibleDescription("Escriba su nombre.");
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(
      "Para abrir la cuenta debe aceptar los términos y autorizar el tratamiento de sus datos.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pide al menos 12 caracteres en la contraseña (MSG-005)", async () => {
    const user = userEvent.setup();
    renderRoute("/registro");

    await fillForm(user, "corta");
    await submit(user);

    const contrasena = screen.getByLabelText("Contraseña");
    expect(contrasena).toHaveFocus();
    expect(contrasena).toHaveAccessibleDescription(
      expect.stringContaining(
        "La contraseña debe tener al menos 12 caracteres.",
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("permite ver la contraseña escrita", async () => {
    const user = userEvent.setup();
    renderRoute("/registro");
    const contrasena = screen.getByLabelText("Contraseña");
    const mostrar = screen.getByRole("button", {
      name: "Mostrar la contraseña",
    });

    expect(contrasena).toHaveAttribute("type", "password");
    await user.click(mostrar);
    expect(contrasena).toHaveAttribute("type", "text");
    expect(mostrar).toHaveAttribute("aria-pressed", "true");
  });

  it("abre las políticas en otra pestaña para no perder lo escrito", () => {
    renderRoute("/registro");

    expect(
      screen.getByRole("link", { name: /términos y condiciones/ }),
    ).toHaveAttribute("target", "_blank");
    expect(
      screen.getByRole("link", { name: /política de privacidad/ }),
    ).toHaveAttribute("href", "/legal/privacidad");
  });

  it("envía la versión legal vigente y pide revisar el correo (CA-HU-005-01)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(ACCEPTED, 202));
    const user = userEvent.setup();
    renderRoute("/registro");

    await fillForm(user);
    await submit(user);

    const aviso = await screen.findByRole("heading", {
      level: 2,
      name: "Revise su correo",
    });
    expect(aviso).toHaveFocus();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    // El acta queda sellada y ya no se puede editar ni volver a enviar.
    expect(
      screen.getByText(/^Acta recibida a las \d{2}:\d{2}\.$/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre completo")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Abrir la cuenta" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).not.toHaveValue(
      "una frase larga y fácil",
    );

    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/api/v1/auth/register");
    expect(await request.json()).toEqual({
      full_name: "Ana Restrepo",
      email: "ana@example.com",
      password: "una frase larga y fácil",
      organization_name: "Restrepo Abogados",
      legal_version: LEGAL_VERSION,
      accepts_legal_terms: true,
    });
  });

  it("pide recargar si los textos legales cambiaron", async () => {
    fetchMock.mockResolvedValue(problem(409));
    const user = userEvent.setup();
    renderRoute("/registro");

    await fillForm(user);
    await submit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Los términos o la política de privacidad cambiaron.",
    );
    expect(
      screen.getByRole("button", { name: "Recargar la página" }),
    ).toBeInTheDocument();
  });

  it("avisa cuando hay demasiados intentos (MSG-004)", async () => {
    fetchMock.mockResolvedValue(problem(429));
    const user = userEvent.setup();
    renderRoute("/registro");

    await fillForm(user);
    await submit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hizo varios intentos seguidos. Espere 15 minutos e inténtelo de nuevo.",
    );
  });

  it("muestra junto al campo un error de validación de la API", async () => {
    fetchMock.mockResolvedValue(
      problem(422, {
        errors: [{ loc: ["body", "email"], msg: "invalid", type: "x" }],
      }),
    );
    const user = userEvent.setup();
    renderRoute("/registro");

    await fillForm(user);
    await submit(user);

    const correo = screen.getByLabelText("Correo electrónico");
    await waitFor(() => expect(correo).toHaveFocus());
    expect(correo).toHaveAccessibleDescription(
      "Escriba un correo válido, por ejemplo nombre@dominio.com.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ante una falla da el código de la solicitud (MSG-019)", async () => {
    fetchMock.mockResolvedValue(problem(500, { request_id: "01a1-codigo" }));
    const user = userEvent.setup();
    renderRoute("/registro");

    await fillForm(user);
    await submit(user);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("No pudimos completar la operación.");
    expect(alerta).toHaveTextContent("01a1-codigo");
  });

  it("ante una falla de red no inventa un código", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderRoute("/registro");

    await fillForm(user);
    await submit(user);

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("No pudimos completar la operación.");
    expect(alerta).not.toHaveTextContent("código");
  });
});
