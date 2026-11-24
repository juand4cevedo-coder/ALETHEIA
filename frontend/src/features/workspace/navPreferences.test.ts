import { beforeEach, describe, expect, it, vi } from "vitest";

import { BROWSER_STORAGE } from "../../config/browserStorage.ts";

const KEY = BROWSER_STORAGE.navigation.key;

async function load() {
  vi.resetModules();
  return import("./navPreferences.ts");
}

beforeEach(() => window.localStorage.clear());

describe("Preferencias del menú lateral", () => {
  it("guarda el modo compacto y los grupos plegados", async () => {
    const prefs = await load();
    prefs.setCompact(true);
    prefs.toggleGroup("comercial");
    prefs.toggleGroup("operacion");
    prefs.toggleGroup("comercial");
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({
      compact: true,
      folded: ["operacion"],
    });
  });

  it("un valor dañado o ajeno cuenta como el menú por omisión", async () => {
    window.localStorage.setItem(KEY, "{no es json");
    const first = await load();
    first.toggleGroup("trabajo");
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({
      compact: false,
      folded: ["trabajo"],
    });

    window.localStorage.setItem(
      KEY,
      JSON.stringify({ compact: "sí", folded: [1, "cuenta"] }),
    );
    const second = await load();
    second.setCompact(false);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({
      compact: false,
      folded: ["cuenta"],
    });
  });
});
