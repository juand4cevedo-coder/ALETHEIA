import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { seriousAxeViolations } from "../../test/axe.ts";
import { AccountTypeChoice } from "./AccountTypeChoice.tsx";
import type { AccountType } from "./signUp.ts";

function Choice() {
  const [value, setValue] = useState<AccountType>("individual");
  return <AccountTypeChoice value={value} onChange={setValue} />;
}

// La opción con data-checked es la que lleva el borde visible de la elegida.
function marked(): string[] {
  return Array.from(document.querySelectorAll("label[data-checked]")).map(
    (label) => label.textContent ?? "",
  );
}

describe("Elección del tipo de cuenta", () => {
  it("marca solo la opción elegida y la marca sigue al cambio", async () => {
    const user = userEvent.setup();
    render(<Choice />);

    expect(screen.getByRole("radio", { name: "Independiente" })).toBeChecked();
    expect(marked()).toEqual(["Independiente"]);

    await user.click(screen.getByRole("radio", { name: "Oficina o firma" }));
    expect(
      screen.getByRole("radio", { name: "Oficina o firma" }),
    ).toBeChecked();
    expect(marked()).toEqual(["Oficina o firma"]);
  });

  it("pasa axe", async () => {
    const { container } = render(<Choice />);
    expect(await seriousAxeViolations(container)).toEqual([]);
  });
});
