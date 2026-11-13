import { beforeEach, describe, expect, it, vi } from "vitest";

import { SAME_ORIGIN_HEADER } from "./sameOrigin.ts";
import { renewsSession, sessionFetch } from "./sessionFetch.ts";

const fetchMock = vi.fn<typeof fetch>();
const origin = window.location.origin;

function api(path: string, init?: RequestInit): Request {
  return new Request(`${origin}${path}`, init);
}

function pathOf(input: unknown): string {
  return new URL((input as Request).url).pathname;
}

function calls(path: string): Request[] {
  return fetchMock.mock.calls
    .map(([input]) => input as Request)
    .filter((request) => pathOf(request) === path);
}

const ok = () => new Response(null, { status: 204 });
const unauthorized = () => new Response(null, { status: 401 });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Qué rutas renuevan la sesión ante un 401", () => {
  it.each([
    ["/api/v1/me", true],
    ["/api/v1/me/legal-acceptance", true],
    ["/api/v1/auth/logout", true],
    ["/api/v1/auth/logout-all", true],
    ["/api/v1/auth/login", false],
    ["/api/v1/auth/refresh", false],
    ["/api/v1/auth/register", false],
    ["/api/v1/auth/verify-email", false],
    ["/precios", false],
  ])("%s → %s", (path, expected) => {
    expect(renewsSession(`${origin}${path}`)).toBe(expected);
  });
});

describe("Renovación silenciosa (HU-009, CA-HU-009-01)", () => {
  it("ante un 401 renueva una vez y repite la petición con el mismo cuerpo", async () => {
    let renewed = false;
    fetchMock.mockImplementation(async (input) => {
      const path = pathOf(input);
      if (path === "/api/v1/auth/refresh") {
        renewed = true;
        return ok();
      }
      return renewed ? ok() : unauthorized();
    });

    const response = await sessionFetch(
      api("/api/v1/me/legal-acceptance", {
        method: "POST",
        body: JSON.stringify({ legal_version: "2026-11-06" }),
      }),
    );

    expect(response.status).toBe(204);
    const [refresh] = calls("/api/v1/auth/refresh");
    expect(refresh!.method).toBe("POST");
    expect(refresh!.headers.get(SAME_ORIGIN_HEADER)).toBe("1");
    const attempts = calls("/api/v1/me/legal-acceptance");
    expect(attempts).toHaveLength(2);
    expect(await attempts[1]!.text()).toBe('{"legal_version":"2026-11-06"}');
  });

  it("varias peticiones que vencen a la vez comparten una sola renovación", async () => {
    let renewed = false;
    fetchMock.mockImplementation(async (input) => {
      if (pathOf(input) === "/api/v1/auth/refresh") {
        // La renovación tarda: las otras peticiones llegan mientras tanto.
        await new Promise((resolve) => setTimeout(resolve, 20));
        renewed = true;
        return ok();
      }
      return renewed ? ok() : unauthorized();
    });

    const responses = await Promise.all([
      sessionFetch(api("/api/v1/me")),
      sessionFetch(api("/api/v1/me")),
      sessionFetch(api("/api/v1/me")),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      204, 204, 204,
    ]);
    // Dos renovaciones con el mismo token cerrarían la sesión entera (CA-HU-009-02).
    expect(calls("/api/v1/auth/refresh")).toHaveLength(1);
  });

  it("si la renovación falla, devuelve el 401 original sin repetir la petición", async () => {
    fetchMock.mockImplementation(async () => unauthorized());

    const response = await sessionFetch(api("/api/v1/me"));

    expect(response.status).toBe(401);
    expect(calls("/api/v1/me")).toHaveLength(1);
    expect(calls("/api/v1/auth/refresh")).toHaveLength(1);
  });

  it("sin red, la renovación falla con calma y el 401 sigue su camino", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (pathOf(input) === "/api/v1/auth/refresh") {
        throw new TypeError("Failed to fetch");
      }
      return unauthorized();
    });

    const response = await sessionFetch(api("/api/v1/me"));

    expect(response.status).toBe(401);
  });

  it("un 401 del ingreso no intenta renovar: la contraseña simplemente no coincide", async () => {
    fetchMock.mockImplementation(async () => unauthorized());

    const response = await sessionFetch(
      api("/api/v1/auth/login", { method: "POST", body: "{}" }),
    );

    expect(response.status).toBe(401);
    expect(calls("/api/v1/auth/refresh")).toHaveLength(0);
  });

  it("las respuestas que no son 401 pasan tal cual, sin renovar", async () => {
    fetchMock.mockImplementation(
      async () => new Response(null, { status: 403 }),
    );

    const response = await sessionFetch(api("/api/v1/me"));

    expect(response.status).toBe(403);
    expect(calls("/api/v1/auth/refresh")).toHaveLength(0);
  });
});
