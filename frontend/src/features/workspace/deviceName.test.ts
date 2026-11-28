import { describe, expect, it } from "vitest";

import { deviceName } from "./deviceName.ts";

describe("deviceName", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36 Edg/158.0.0.0",
      "Edge en Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari en iPhone",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
      "Chrome en Android",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:130.0) Gecko/20100101 Firefox/130.0",
      "Firefox en Mac",
    ],
    ["python-requests/2.32", "Otro navegador"],
  ])("%s", (agent, name) => {
    expect(deviceName(agent)).toBe(name);
  });

  it("sin cadena no inventa nada", () => {
    expect(deviceName(null)).toBeNull();
    expect(deviceName("")).toBeNull();
  });
});
