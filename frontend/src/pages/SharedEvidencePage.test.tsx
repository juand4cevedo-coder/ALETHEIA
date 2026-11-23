import { screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("comprueba el enlace sin enviarlo en la URL y ofrece la descarga con la huella", async () => {
  fetchMock.mockResolvedValue(
    jsonResponse({
      filename: "informe.pdf",
      size_bytes: 2048,
      sha256: "ab".repeat(32),
      expires_at: "2026-12-01T15:00:00Z",
    }),
  );
  const { router, container } = await renderRoute(
    "/compartido#t=token-de-prueba",
  );

  expect(
    await screen.findByRole("button", { name: "Descargar el archivo" }),
  ).toBeInTheDocument();
  expect(screen.getByText("informe.pdf")).toBeInTheDocument();
  expect(router.state.location.hash).toBe("");
  const request = fetchMock.mock.calls[0]![0] as Request;
  expect(new URL(request.url).pathname).toBe("/api/v1/shared-evidence/inspect");
  expect(await request.json()).toEqual({ token: "token-de-prueba" });
  const form = container.querySelector("form");
  expect(form).toHaveAttribute("method", "post");
  expect(form).toHaveAttribute("action", "/api/v1/shared-evidence/download");
  expect(form?.querySelector('input[name="token"]')).toHaveValue(
    "token-de-prueba",
  );
});

it("informa cuando el enlace venció o fue revocado", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ status: 404 }, 404));
  await renderRoute("/compartido#t=token-vencido");
  expect(
    await screen.findByText(/ya venció o fue revocado/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Descargar el archivo" }),
  ).not.toBeInTheDocument();
});

it("sin token en la dirección no consulta nada", async () => {
  await renderRoute("/compartido");
  expect(
    await screen.findByText(/ya venció o fue revocado/),
  ).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
