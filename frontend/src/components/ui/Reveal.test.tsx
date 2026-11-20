import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Reveal } from "./Reveal.tsx";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

// Observador simulado: guarda su callback para que cada prueba decida si dispara y cuándo.
let callback: Callback = () => {};
const disconnect = vi.fn();

function stubObserver(overrides: { observe?: () => void } = {}) {
  class FakeObserver {
    constructor(cb: Callback) {
      callback = cb;
    }
    observe = overrides.observe ?? vi.fn();
    unobserve = vi.fn();
    disconnect = disconnect;
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
}

const content = () => screen.getByText("texto");

afterEach(() => {
  vi.unstubAllGlobals();
  disconnect.mockClear();
});

// Estas pruebas fijan el invariante: el contenido solo se oculta cuando el observador ya
// demostró que funciona. Cada una falla si se vuelve a ocultar antes de la primera notificación.
describe("Reveal: nunca deja el contenido invisible", () => {
  it("queda visible cuando el navegador no tiene IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Reveal>texto</Reveal>);
    expect(content()).toHaveAttribute("data-visible", "true");
  });

  it("queda visible cuando el constructor del observador lanza una excepción", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor() {
          throw new Error("sin soporte");
        }
      },
    );
    render(<Reveal>texto</Reveal>);
    expect(content()).toHaveAttribute("data-visible", "true");
  });

  it("queda visible y desconecta cuando observe lanza una excepción", () => {
    stubObserver({
      observe: () => {
        throw new Error("falla al observar");
      },
    });
    render(<Reveal>texto</Reveal>);
    expect(content()).toHaveAttribute("data-visible", "true");
    expect(disconnect).toHaveBeenCalled();
  });

  it("queda visible cuando el observador existe pero su callback nunca se dispara", () => {
    stubObserver();
    render(<Reveal>texto</Reveal>);
    expect(content()).toHaveAttribute("data-visible", "true");
  });

  it("queda visible y desconecta si la primera notificación ya está en pantalla", () => {
    stubObserver();
    render(<Reveal>texto</Reveal>);
    callback([{ isIntersecting: true }]);
    expect(content()).toHaveAttribute("data-visible", "true");
    expect(disconnect).toHaveBeenCalled();
  });

  it("se oculta con una primera notificación fuera de pantalla", () => {
    stubObserver();
    render(<Reveal>texto</Reveal>);
    callback([{ isIntersecting: false }]);
    expect(content()).toHaveAttribute("data-visible", "false");
  });

  it("se muestra al cruzar y no vuelve a ocultarse", () => {
    stubObserver();
    render(<Reveal>texto</Reveal>);
    callback([{ isIntersecting: false }]);
    callback([{ isIntersecting: true }]);
    expect(content()).toHaveAttribute("data-visible", "true");
    expect(disconnect).toHaveBeenCalled();
    // Un observador real ya desconectado no notifica; si lo hiciera, tampoco debe ocultar.
    callback([{ isIntersecting: true }]);
    expect(content()).toHaveAttribute("data-visible", "true");
  });

  it("deja el elemento visible si se desmonta entre ocultar y revelar", () => {
    stubObserver();
    const { unmount } = render(<Reveal>texto</Reveal>);
    callback([{ isIntersecting: false }]);
    const element = content();
    expect(element).toHaveAttribute("data-visible", "false");
    unmount();
    expect(element).toHaveAttribute("data-visible", "true");
  });
});
