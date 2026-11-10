import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Reveal } from "./Reveal.tsx";

describe("Reveal", () => {
  it("muestra el contenido desde el primer render", () => {
    render(<Reveal>Texto</Reveal>);
    const el = screen.getByText("Texto");
    expect(el).toBeVisible();
    expect(el).not.toHaveAttribute("data-state");
  });
});
