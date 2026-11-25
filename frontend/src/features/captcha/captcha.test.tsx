import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { encodeSolution, findNumber, type CaptchaChallenge } from "./solve.ts";
import { useCaptcha } from "./useCaptcha.ts";

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function challengeFor(number: number): Promise<CaptchaChallenge> {
  const salt = "abc123?expires=1999999999&";
  return {
    algorithm: "SHA-256",
    challenge: await sha256Hex(`${salt}${number}`),
    maxnumber: 500,
    salt,
    signature: "firma",
  };
}

describe("Cálculo de la verificación de persona", () => {
  it("encuentra el número que produce el reto", async () => {
    expect(await findNumber(await challengeFor(377))).toBe(377);
  });

  it("dice cuando el número no está en el rango", async () => {
    const challenge = await challengeFor(377);
    expect(await findNumber({ ...challenge, maxnumber: 100 })).toBeNull();
  });

  it("codifica la solución como la espera la API", async () => {
    const challenge = await challengeFor(5);
    expect(JSON.parse(atob(encodeSolution(challenge, 5)))).toEqual({
      algorithm: "SHA-256",
      challenge: challenge.challenge,
      number: 5,
      salt: challenge.salt,
      signature: "firma",
    });
  });
});

describe("Gancho de la verificación", () => {
  it("empieza resolviendo, queda lista y cada envío prepara la siguiente", async () => {
    const captcha = await import("./captcha.ts");
    const solve = vi.spyOn(captcha, "solveCaptcha");
    const { result } = renderHook(() => useCaptcha());
    expect(result.current.status).toBe("solving");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    let token = "";
    await act(async () => {
      token = await result.current.take();
    });
    expect(token).toBe("solucion-de-prueba");
    expect(solve).toHaveBeenCalledTimes(2);
  });

  it("si falla lo dice y permite reintentar", async () => {
    const captcha = await import("./captcha.ts");
    const solve = vi
      .spyOn(captcha, "solveCaptcha")
      .mockRejectedValueOnce(new Error("sin red"));
    const { result } = renderHook(() => useCaptcha());
    await waitFor(() => expect(result.current.status).toBe("failed"));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(solve).toHaveBeenCalledTimes(2);
  });
});
