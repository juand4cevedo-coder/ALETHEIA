import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { client } from "../api/generated/client.gen.ts";

// En el navegador las rutas relativas como /api/v1/plans se resuelven contra el sitio; en
// Node, Request exige una URL completa. Se usa el origen de jsdom.
client.setConfig({ baseUrl: window.location.origin });

// jsdom no desplaza la página; ScrollRestoration de React Router llama a scrollTo al navegar.
window.scrollTo = () => {};

// Desmonta lo que cada prueba renderizó, para que la siguiente empiece con la página vacía.
afterEach(() => {
  cleanup();
});

// jsdom aún no implementa showModal ni close de <dialog>. Este reemplazo mínimo abre y cierra
// el diálogo y emite el evento close, que es lo que usa el menú móvil.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
