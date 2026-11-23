import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deviceClass,
  interactionToNextPaint,
  LayoutShiftWindows,
  pageGroup,
  startVitals,
} from "./collect.ts";

describe("pageGroup", () => {
  it.each([
    ["/", "inicio"],
    ["/precios", "precios"],
    ["/precios/", "precios"],
    ["/ingresar", "ingreso"],
    ["/registro", "ingreso"],
    ["/docs", "documentacion"],
    ["/docs/crear-un-caso", "documentacion"],
    ["/legal/cookies", "legal"],
    ["/app", "espacio"],
    ["/app/casos/0190-abc/evidencias/9", "espacio"],
    ["/nosotros", "otra"],
    ["/algo-que-no-existe", "otra"],
  ])("agrupa %s como %s, sin conservar la ruta", (path, group) => {
    expect(pageGroup(path)).toBe(group);
  });
});

it("distingue móvil de escritorio por el ancho de la pantalla", () => {
  expect(deviceClass(375)).toBe("movil");
  expect(deviceClass(767)).toBe("movil");
  expect(deviceClass(768)).toBe("escritorio");
});

describe("interactionToNextPaint", () => {
  it("no entrega nada si no hubo interacciones", () => {
    expect(interactionToNextPaint([])).toBeUndefined();
  });

  it("usa la peor interacción cuando hubo pocas", () => {
    expect(interactionToNextPaint([80, 300, 120])).toBe(300);
  });

  it("descarta la peor por cada 50 interacciones", () => {
    const durations = Array.from({ length: 100 }, (_, index) => index + 1);
    // Con 100 interacciones cuenta la tercera peor: 98.
    expect(interactionToNextPaint(durations)).toBe(98);
  });
});

describe("LayoutShiftWindows", () => {
  it("suma los saltos cercanos y conserva la ventana más grande", () => {
    const windows = new LayoutShiftWindows();
    windows.add({ value: 0.1, startTime: 100 });
    windows.add({ value: 0.1, startTime: 600 });
    windows.add({ value: 0.05, startTime: 4000 });

    expect(windows.value).toBeCloseTo(0.2);
  });

  it("empieza otra ventana pasados 5 segundos aunque los saltos sigan cerca", () => {
    const windows = new LayoutShiftWindows();
    for (let time = 0; time <= 6000; time += 900)
      windows.add({ value: 0.02, startTime: time });

    // 0, 900, ..., 4500 son 6 saltos en la primera ventana; el de 5400 empieza otra.
    expect(windows.value).toBeCloseTo(0.12);
  });
});

describe("startVitals", () => {
  type Callback = (list: { getEntries: () => unknown[] }) => void;
  let observers: Map<string, Callback>;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    observers = new Map();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    class FakeObserver {
      static supportedEntryTypes = [
        "paint",
        "largest-contentful-paint",
        "layout-shift",
        "event",
        "navigation",
      ];
      readonly callback: Callback;
      constructor(callback: Callback) {
        this.callback = callback;
      }
      observe(options: { type: string }) {
        observers.set(options.type, this.callback);
      }
    }
    vi.stubGlobal("PerformanceObserver", FakeObserver);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  function emit(type: string, entries: unknown[]) {
    observers.get(type)!({ getEntries: () => entries });
  }

  function leave() {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  it("entrega una sola vez, al salir, solo con medidas y sin datos de la persona", async () => {
    startVitals(() => true);
    emit("paint", [{ name: "first-contentful-paint", startTime: 1200.4 }]);
    emit("largest-contentful-paint", [
      { startTime: 1500 },
      { startTime: 2100.2 },
    ]);
    emit("layout-shift", [
      { value: 0.03, startTime: 800, hadRecentInput: false },
      { value: 0.5, startTime: 900, hadRecentInput: true },
    ]);
    emit("navigation", [{ responseStart: 310 }]);

    leave();
    leave();
    window.dispatchEvent(new Event("pagehide"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/web-vitals");
    expect(init).toMatchObject({
      method: "POST",
      keepalive: true,
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        "X-Aletheia-Request": "1",
      },
    });
    const body = JSON.parse(String(init!.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ["device", "metrics", "page"]
        .concat("connection" in body ? ["connection"] : [])
        .sort(),
    );
    expect(body.metrics).toEqual(
      expect.arrayContaining([
        { name: "FCP", value: 1200.4 },
        { name: "LCP", value: 2100.2 },
        { name: "CLS", value: 0.03 },
        { name: "TTFB", value: 310 },
      ]),
    );
  });

  it("no envía nada si la persona retira la analítica antes de salir", () => {
    let allowed = true;
    startVitals(() => allowed);
    emit("paint", [{ name: "first-contentful-paint", startTime: 900 }]);
    allowed = false;

    leave();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no mide una pestaña que se abrió en segundo plano", () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });

    startVitals(() => true);

    expect(observers.size).toBe(0);
  });

  it("no envía una visita sin ninguna medida", () => {
    startVitals(() => true);

    leave();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
