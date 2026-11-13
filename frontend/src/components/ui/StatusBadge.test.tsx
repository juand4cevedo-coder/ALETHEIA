import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./StatusBadge.tsx";

describe("Insignia de estado", () => {
  it.each(["ok", "pending", "error", "muted", "closed"] as const)(
    "el tono %s siempre lleva texto visible",
    (tone) => {
      render(<StatusBadge tone={tone}>Estado</StatusBadge>);
      expect(screen.getByText("Estado")).toBeVisible();
    },
  );
});
