import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import type { MySubscription } from "../../api/generated";
import { PlanStatusNotice } from "./PlanStatusNotice.tsx";
import { trialDaysLeft } from "./trial.ts";

const NOW = new Date("2026-11-24T15:00:00Z");

function trial(endsAt: string): MySubscription {
  return {
    plan_name: "Prueba",
    status: "trial",
    access_source: "trial",
    ends_at: endsAt,
  };
}

function show(subscription: MySubscription | null, canPay = true) {
  return render(
    <MemoryRouter>
      <PlanStatusNotice subscription={subscription} canPay={canPay} now={NOW} />
    </MemoryRouter>,
  );
}

describe("trialDaysLeft", () => {
  it("cuenta días del calendario de Colombia y nunca da menos de cero", () => {
    expect(trialDaysLeft("2026-12-08T15:00:00Z", NOW)).toBe(14);
    expect(trialDaysLeft("2026-11-25T21:00:00Z", NOW)).toBe(1);
    // Las 2 de la mañana del 25 en UTC son todavía el 24 en Colombia.
    expect(trialDaysLeft("2026-11-25T02:00:00Z", NOW)).toBe(0);
    expect(trialDaysLeft("2026-11-23T10:00:00Z", NOW)).toBe(0);
  });
});

describe("PlanStatusNotice", () => {
  it("desde el primer día muestra los días que quedan, sin tono de aviso", () => {
    show(trial("2026-12-08T15:00:00Z"));
    const notice = screen.getByRole("region", { name: "Su prueba gratuita" });
    expect(notice).toHaveTextContent("Le quedan 14 días de prueba.");
    expect(notice).toHaveTextContent("Nada se cobra solo.");
    expect(notice).not.toHaveAttribute("data-urgent");
    expect(
      screen.getByRole("link", { name: "Elegir un plan" }),
    ).toHaveAttribute("href", "/app/facturacion");
  });

  it("los últimos tres días se vuelve un aviso", () => {
    show(trial("2026-11-25T15:00:00Z"));
    const notice = screen.getByRole("region", { name: "Su prueba gratuita" });
    expect(notice).toHaveTextContent("Le queda 1 día de prueba.");
    expect(notice).toHaveAttribute("data-urgent");
  });

  it("el último día dice que la prueba termina hoy", () => {
    show(trial("2026-11-24T20:00:00Z"));
    expect(
      screen.getByRole("region", { name: "Su prueba gratuita" }),
    ).toHaveTextContent("Su prueba termina hoy.");
  });

  it("a quien no puede pagar le pide avisar, sin botón", () => {
    show(trial("2026-12-01T15:00:00Z"), false);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Avise a la persona responsable del despacho para que elija un plan.",
      ),
    ).toBeInTheDocument();
  });

  it("distingue la prueba vencida del plan vencido", () => {
    const { unmount } = show({
      plan_name: "Prueba",
      status: "expired",
      access_source: "trial",
      ends_at: "2026-11-01T00:00:00Z",
    });
    expect(
      screen.getByText("Su período de prueba venció."),
    ).toBeInTheDocument();
    unmount();
    show({
      plan_name: "Profesional",
      status: "expired",
      access_source: "payment",
      ends_at: "2026-11-01T00:00:00Z",
    });
    expect(screen.getByText("Su plan venció.")).toBeInTheDocument();
  });

  it("con el plan activo no muestra nada", () => {
    const { container } = show({
      plan_name: "Profesional",
      status: "active",
      access_source: "payment",
      ends_at: "2027-01-01T00:00:00Z",
    });
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PlanStatusNotice se puede ocultar", () => {
  it("la cuenta regresiva se oculta y no vuelve mientras falta tiempo", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const first = show(trial("2026-12-08T15:00:00Z"));

    await user.click(
      screen.getByRole("button", { name: "Ocultar el aviso de la prueba" }),
    );

    expect(
      screen.queryByRole("region", { name: "Su prueba gratuita" }),
    ).not.toBeInTheDocument();
    first.unmount();
    show(trial("2026-12-08T15:00:00Z"));
    expect(
      screen.queryByRole("region", { name: "Su prueba gratuita" }),
    ).not.toBeInTheDocument();
    // Los últimos días vuelve a aparecer, aunque se haya ocultado antes.
    show(trial("2026-11-25T15:00:00Z"));
    expect(
      screen.getByRole("region", { name: "Su prueba gratuita" }),
    ).toHaveAttribute("data-urgent");
  });

  it("el plan vencido no se puede ocultar", () => {
    show({
      plan_name: "Prueba",
      status: "expired",
      access_source: "trial",
      ends_at: "2026-11-20T15:00:00Z",
    });
    expect(
      screen.queryByRole("button", { name: /Ocultar/ }),
    ).not.toBeInTheDocument();
  });
});
