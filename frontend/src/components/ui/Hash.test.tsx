import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Hash } from "./Hash.tsx";

const VALUE =
  "52A910D44B570BC5CD4D35E1C7420D0D05C2920518D70B61B6F04595B5B9A6F5";
const LOWER = VALUE.toLowerCase();

describe("Huella SHA-256 (CMP-UI-007)", () => {
  it("muestra la huella completa en minúsculas y en bloques de 8", () => {
    render(<Hash value={VALUE} copyable={false} />);
    expect(
      screen.getByText(
        "52a910d4 4b570bc5 cd4d35e1 c7420d0d 05c29205 18d70b61 b6f04595 b5b9a6f5",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("la versión abreviada conserva la huella completa para lectores de pantalla", () => {
    render(<Hash value={VALUE} variant="short" copyable={false} />);
    expect(screen.getByText("52a910d4 4b570bc5 …")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByText(LOWER)).toHaveClass("visually-hidden");
  });

  it("copia los 64 caracteres sin espacios y lo confirma", async () => {
    const user = userEvent.setup();
    render(<Hash value={VALUE} />);

    await user.click(screen.getByRole("button", { name: "Copiar huella" }));

    expect(await navigator.clipboard.readText()).toBe(LOWER);
    expect(screen.getByRole("button", { name: "Copiada" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Huella copiada.");
  });
});
