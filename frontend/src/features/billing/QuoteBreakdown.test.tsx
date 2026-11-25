import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BillingQuoteOption } from "../../api/generated";
import { QuoteBreakdown } from "./QuoteBreakdown.tsx";

const FIRMA: BillingQuoteOption = {
  plan_code: "firm",
  plan_name: "Firma",
  billing_cycle: "monthly",
  included_users: 8,
  fits: true,
  plan_cop: 149_900,
  extra_users: 0,
  extra_user_unit_cop: 14_900,
  extra_users_cop: 0,
  total_cop: 149_900,
};

describe("Desglose del valor antes de pagar", () => {
  it("sin usuarios adicionales muestra solo el plan y el total", () => {
    render(<QuoteBreakdown option={FIRMA} users={5} />);

    expect(screen.getByText("Plan Firma, mensual")).toBeInTheDocument();
    expect(screen.getByText("Incluye 8 usuarios")).toBeInTheDocument();
    expect(screen.queryByText(/adicional/)).not.toBeInTheDocument();
    expect(screen.getByText("Total al mes")).toBeInTheDocument();
    expect(screen.getAllByText("$149.900")).toHaveLength(2);
  });

  it("con un adicional lo nombra en singular", () => {
    render(
      <QuoteBreakdown
        option={{
          ...FIRMA,
          extra_users: 1,
          extra_users_cop: 14_900,
          total_cop: 164_800,
        }}
        users={9}
      />,
    );

    expect(screen.getByText("1 usuario adicional")).toBeInTheDocument();
    expect(screen.getByText("$164.800")).toBeInTheDocument();
  });

  it("si el equipo no cabe, lo explica en vez de dar un valor", () => {
    render(
      <QuoteBreakdown
        option={{
          ...FIRMA,
          plan_name: "Esencial",
          included_users: 1,
          fits: false,
        }}
        users={1}
      />,
    );

    expect(
      screen.getByText(
        /Su equipo tiene 1 persona, contando las invitaciones abiertas, y el plan Esencial incluye 1 usuario sin adicionales/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Total/)).not.toBeInTheDocument();
  });
});
