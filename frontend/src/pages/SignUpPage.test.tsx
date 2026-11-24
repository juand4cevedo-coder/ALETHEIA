import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({ enabled: true }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("Crear cuenta con Google", () => {
  it("presenta solo Google y no pide correo ni contraseña", async () => {
    const { container } = await renderRoute("/registro");

    expect(
      screen.getByRole("heading", { level: 1, name: "Cree su cuenta" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Crear cuenta con Google" }),
    ).toBeEnabled();
    expect(
      screen.queryByLabelText("Correo electrónico"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute(
      "href",
      "/ingresar",
    );
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("ofrece crear la cuenta con correo y contraseña como alternativa", async () => {
    await renderRoute("/registro");

    expect(
      await screen.findByRole("link", {
        name: "Crear la cuenta con correo y contraseña",
      }),
    ).toHaveAttribute("href", "/registro/correo");
  });

  it("no presume la aceptación legal y enfoca la casilla", async () => {
    const user = userEvent.setup();
    await renderRoute("/registro");
    const submit = await screen.findByRole("button", {
      name: "Crear cuenta con Google",
    });

    await user.click(submit);

    const consent = screen.getByRole("checkbox");
    expect(consent).toHaveFocus();
    expect(consent).toHaveAccessibleDescription(
      "Para abrir la cuenta debe aceptar los términos y autorizar el tratamiento de sus datos.",
    );
  });

  it("envía el tipo personal y la versión legal al inicio OIDC", async () => {
    const user = userEvent.setup();
    const { container } = await renderRoute("/registro");
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    form!.addEventListener("submit", (event) => event.preventDefault());

    await user.click(screen.getByRole("checkbox"));
    await user.click(
      await screen.findByRole("button", { name: "Crear cuenta con Google" }),
    );

    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/api/v1/auth/google/register");
    const data = new FormData(form!);
    expect(data.get("account_type")).toBe("individual");
    expect(data.get("legal_version")).toBe(LEGAL_VERSION);
    expect(data.get("accepts_legal_terms")).toBe("on");
  });

  it("exige el nombre de la firma y luego lo incluye", async () => {
    const user = userEvent.setup();
    const { container } = await renderRoute("/registro");
    const form = container.querySelector("form")!;
    form.addEventListener("submit", (event) => event.preventDefault());
    await user.click(screen.getByRole("radio", { name: "Oficina o firma" }));
    await user.click(screen.getByRole("checkbox"));
    const submit = await screen.findByRole("button", {
      name: "Crear cuenta con Google",
    });

    await user.click(submit);
    const organization = screen.getByLabelText("Nombre de la oficina o firma");
    expect(organization).toHaveFocus();
    expect(organization).toHaveAccessibleDescription(
      "Escriba el nombre de su oficina o firma.",
    );

    await user.type(organization, "Restrepo Abogados");
    await user.click(submit);
    const data = new FormData(form);
    expect(data.get("account_type")).toBe("firm");
    expect(data.get("organization_name")).toBe("Restrepo Abogados");
  });

  it("explica por qué un correo existente no se enlaza automáticamente", async () => {
    await renderRoute("/registro?google=correo-en-uso");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya existe una cuenta con ese correo. Ingrese y vincule Google desde Mi cuenta.",
    );
  });

  it("mantiene deshabilitado Google cuando faltan sus credenciales", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ enabled: false }));
    await renderRoute("/registro");

    expect(
      await screen.findByRole("button", { name: "Crear cuenta con Google" }),
    ).toBeDisabled();
    expect(screen.getByText(/termine su configuración/)).toBeInTheDocument();
  });
});
