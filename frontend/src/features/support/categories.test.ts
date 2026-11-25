import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dueState,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
} from "./categories.ts";

afterEach(() => vi.useRealTimers());

describe("Tipos de solicitud y plazos", () => {
  it("cada tipo tiene nombre y explica su plazo", () => {
    for (const item of TICKET_CATEGORIES) {
      expect(TICKET_CATEGORY_LABELS[item.value]).toBe(item.label);
      expect(item.description).toMatch(/\d+ días (hábiles|calendario)/);
    }
  });

  it("dice si el plazo venció, vence pronto o está holgado, en hora de Colombia", () => {
    vi.useFakeTimers();
    // 24 de noviembre a las 11:30 p. m. en Colombia: en UTC ya es 25.
    vi.setSystemTime(new Date("2026-11-25T04:30:00Z"));
    expect(dueState("2026-11-23")).toBe("overdue");
    expect(dueState("2026-11-24")).toBe("soon");
    expect(dueState("2026-11-27")).toBe("soon");
    expect(dueState("2026-11-28")).toBe("ok");
  });
});
