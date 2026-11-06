import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tokenFromHash } from "../features/auth/linkToken.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function problem(status: number) {
  return jsonResponse(
    { type: "about:blank", title: "Error", status, instance: "/api/v1" },
    status,
  );
}

async function requestBody(index: number) {
  const request = fetchMock.mock.calls[index]![0] as Request;
  return { path: new URL(request.url).pathname, body: await request.json() };
}

describe("Verificar el correo (HU-006, CP-006)", () => {
  it("lee el token del fragmento", () => {
    expect(tokenFromHash("#t=abc.def.ghi")).toBe("abc.def.ghi");
    expect(tokenFromHash("#t=")).toBeNull();
    expect(tokenFromHash("")).toBeNull();
  });

  it("envía el token una sola vez y muestra la constancia (CA-HU-006-01)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { container } = await renderRoute(
      "/verificar-correo#t=token.de.prueba",
    );

    const titulo = await screen.findByRole("heading", {
      level: 1,
      name: "Correo verificado",
    });
    await waitFor(() => expect(titulo).toHaveFocus());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await requestBody(0)).toEqual({
      path: "/api/v1/auth/verify-email",
      body: { token: "token.de.prueba" },
    });
    expect(screen.getByText("Usado. No vuelve a servir.")).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: "Ingresar" }),
    ).toHaveAttribute("href", "/ingresar");
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("si el enlace ya no sirve ofrece pedir uno nuevo", async () => {
    fetchMock
      .mockResolvedValueOnce(problem(400))
      .mockResolvedValueOnce(jsonResponse({ detail: "ok" }, 202));
    const user = userEvent.setup();
    await renderRoute("/verificar-correo#t=vencido");

    await screen.findByRole("heading", { name: "Este enlace ya no sirve" });
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "ana@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Enviarme un enlace nuevo" }),
    );

    expect(
      await within(screen.getByRole("main")).findByRole("status"),
    ).toHaveTextContent(
      "Si hay una cuenta por verificar con ana@example.com, le enviamos un enlace nuevo.",
    );
    expect(await requestBody(1)).toEqual({
      path: "/api/v1/auth/verify-email/resend",
      body: { email: "ana@example.com" },
    });
  });

  it("sin token no llama a la API y ofrece pedir uno nuevo", async () => {
    await renderRoute("/verificar-correo");

    expect(
      await screen.findByText(/El enlace llegó incompleto/),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("valida el correo antes de pedir un enlace nuevo", async () => {
    const user = userEvent.setup();
    await renderRoute("/verificar-correo");

    await user.type(screen.getByLabelText("Correo electrónico"), "ana");
    await user.click(
      screen.getByRole("button", { name: "Enviarme un enlace nuevo" }),
    );

    expect(
      screen.getByLabelText("Correo electrónico"),
    ).toHaveAccessibleDescription(
      "Escriba un correo válido, por ejemplo nombre@dominio.com.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("avisa cuando hay demasiados intentos (MSG-004)", async () => {
    fetchMock.mockResolvedValue(problem(429));
    await renderRoute("/verificar-correo#t=token");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hizo varios intentos seguidos.",
    );
  });
});
