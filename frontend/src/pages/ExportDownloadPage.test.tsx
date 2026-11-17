import { screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

it("comprueba el token sin enviarlo en la URL y ofrece un formulario nativo", async () => {
  fetchMock.mockResolvedValue(
    jsonResponse({ expires_at: "2026-11-18T15:00:00Z" }),
  );
  const { router, container } = await renderRoute(
    "/descargar-paquete#t=token-de-prueba",
  );

  expect(
    await screen.findByRole("button", { name: "Descargar ZIP" }),
  ).toBeInTheDocument();
  expect(router.state.location.hash).toBe("");
  const request = fetchMock.mock.calls[0]![0] as Request;
  expect(new URL(request.url).pathname).toBe("/api/v1/exports/inspect");
  expect(await request.json()).toEqual({ token: "token-de-prueba" });
  const form = container.querySelector("form");
  expect(form).toHaveAttribute("method", "post");
  expect(form).toHaveAttribute("action", "/api/v1/exports/download");
  expect(form?.querySelector('input[name="token"]')).toHaveValue(
    "token-de-prueba",
  );
});

it("informa cuando el enlace no existe o ya venció", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ status: 404 }, 404));
  await renderRoute("/descargar-paquete#t=token-vencido");
  expect(await screen.findByText(/ya venció/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Descargar ZIP" }),
  ).not.toBeInTheDocument();
});
