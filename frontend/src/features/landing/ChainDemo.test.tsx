import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CUSTODY_ACTION_LABELS } from "../cases/custodyActions.ts";
import {
  ALTERED_INDEX,
  ALTERED_TIME,
  CHAIN_EVENTS,
  GENESIS,
  chainRecord,
} from "./chain.ts";
import { ChainDemo } from "./ChainDemo.tsx";
import { sha256Hex } from "./useSha256.ts";

describe("Demostración de la cadena de custodia", () => {
  it("las huellas precalculadas encadenan de verdad", async () => {
    // Se calcula con Web Crypto (sin node:crypto) para que tsc -b no exija tipos de Node.
    expect(CHAIN_EVENTS).toHaveLength(4);
    let prev = GENESIS;
    for (const event of CHAIN_EVENTS) {
      expect(event.hash).toBe(
        await sha256Hex(chainRecord(prev, event.time, event.text)),
      );
      prev = event.hash;
    }
  });

  it("solo muestra acciones de la lista cerrada de custodia", () => {
    // Cada texto corresponde a una acción real: subir, sellar, descargar y pedir el paquete.
    const actions = [
      "evidence_uploaded",
      "evidence_stamped",
      "evidence_downloaded",
      "export_requested",
    ];
    for (const action of actions) {
      expect(CUSTODY_ACTION_LABELS[action]).toBeDefined();
    }
    expect(CHAIN_EVENTS.map((event) => event.text)).toEqual([
      "Laura Gómez subió el original con su huella SHA-256",
      "La autoridad externa emitió el sello de tiempo",
      "Andrés Ruiz descargó el original",
      "Laura Gómez solicitó el paquete de preservación",
    ]);
  });

  it("al cambiar la hora del evento 3 la cadena se rompe desde ahí, y vuelve al restaurarla", async () => {
    const user = userEvent.setup();
    render(<ChainDemo />);

    const items = () => screen.getAllByRole("listitem");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cada huella anterior coincide con la del evento previo",
    );
    expect(items().map((item) => item.dataset.broken)).toEqual([
      "false",
      "false",
      "false",
      "false",
    ]);

    await user.click(
      screen.getByRole("button", { name: "Cambiar la hora del evento 3" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "La cadena se rompe en el evento 3",
    );
    expect(items().map((item) => item.dataset.broken)).toEqual([
      "false",
      "false",
      "true",
      "true",
    ]);
    expect(items()[ALTERED_INDEX]).toHaveTextContent(ALTERED_TIME);
    expect(items()[ALTERED_INDEX + 1]).toHaveTextContent(
      "Su huella anterior ya no coincide con la del evento 3.",
    );

    await user.click(
      screen.getByRole("button", { name: "Restaurar la hora original" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cada huella anterior coincide con la del evento previo",
    );
    expect(items().map((item) => item.dataset.broken)).toEqual([
      "false",
      "false",
      "false",
      "false",
    ]);
    expect(items()[ALTERED_INDEX]).toHaveTextContent(
      CHAIN_EVENTS[ALTERED_INDEX].time,
    );
  });

  it("el registro alterado muestra su huella recalculada, distinta de la registrada", async () => {
    const user = userEvent.setup();
    render(<ChainDemo />);

    await user.click(
      screen.getByRole("button", { name: "Cambiar la hora del evento 3" }),
    );

    const recomputed = await sha256Hex(
      chainRecord(
        CHAIN_EVENTS[ALTERED_INDEX - 1].hash,
        ALTERED_TIME,
        CHAIN_EVENTS[ALTERED_INDEX].text,
      ),
    );
    expect(recomputed).not.toBe(CHAIN_EVENTS[ALTERED_INDEX].hash);
    expect(await screen.findByText(recomputed)).toBeInTheDocument();
  });

  it("no lleva la etiqueta de datos ficticios", () => {
    const { container } = render(<ChainDemo />);
    expect(container.textContent).not.toMatch(/ficticios|de ejemplo/i);
  });
});
