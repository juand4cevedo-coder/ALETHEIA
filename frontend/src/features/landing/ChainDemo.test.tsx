import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CHAIN_EVENTS, GENESIS, chainRecord } from "./chain.ts";
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

  it("al alterar el evento 2 la cadena se rompe desde ahí, y vuelve al deshacerlo", async () => {
    const user = userEvent.setup();
    render(<ChainDemo />);

    const button = screen.getByRole("button", { name: "Alterar el evento 2" });
    const items = () => screen.getAllByRole("listitem");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent(
      "La cadena está íntegra",
    );
    expect(items().map((item) => item.dataset.broken)).toEqual([
      "false",
      "false",
      "false",
      "false",
    ]);

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "La cadena se rompe en el evento 2",
    );
    expect(items().map((item) => item.dataset.broken)).toEqual([
      "false",
      "true",
      "true",
      "true",
    ]);
    expect(items()[1]).toHaveTextContent("08:15:00");

    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent(
      "La cadena está íntegra",
    );
    expect(items().map((item) => item.dataset.broken)).toEqual([
      "false",
      "false",
      "false",
      "false",
    ]);
    expect(items()[1]).toHaveTextContent("10:39:05");
  });

  it("el registro alterado muestra su huella recalculada, distinta de la registrada", async () => {
    const user = userEvent.setup();
    render(<ChainDemo />);

    await user.click(
      screen.getByRole("button", { name: "Alterar el evento 2" }),
    );

    const recomputed = await sha256Hex(
      chainRecord(CHAIN_EVENTS[0].hash, "08:15:00", CHAIN_EVENTS[1].text),
    );
    expect(recomputed).not.toBe(CHAIN_EVENTS[1].hash);
    expect(await screen.findByText(recomputed)).toBeInTheDocument();
  });

  it("rotula los datos como ficticios", () => {
    render(<ChainDemo />);
    expect(screen.getByText("Datos ficticios")).toBeInTheDocument();
  });
});
