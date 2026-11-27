import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BillingQuoteOption } from "../api/generated";
import { LEGAL_VERSION } from "../config/legal.ts";
import { seriousAxeViolations } from "../test/axe.ts";
import { CATALOG } from "../test/plans.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const ME = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  full_name: "Ana Restrepo",
  email: "ana@example.com",
  email_verified: true,
  google_linked: false,
  platform_admin: false,
  permissions: ["billing.manage"],
  organization: {
    id: "01890a5d-ac96-774b-bcce-b302099a8059",
    name: "Restrepo Abogados",
    role: "owner",
    kind: "individual",
  },
  subscription: {
    plan_name: "Prueba",
    status: "trial",
    access_source: "trial",
    ends_at: "2026-12-01T00:00:00Z",
  },
  legal: {
    accepted_version: LEGAL_VERSION,
    current_version: LEGAL_VERSION,
    acceptance_required: false,
  },
};

function option(
  plan_code: string,
  plan_name: string,
  billing_cycle: "monthly" | "annual",
  values: Partial<BillingQuoteOption>,
): BillingQuoteOption {
  return {
    plan_code,
    plan_name,
    billing_cycle,
    included_users: 1,
    max_users: 1,
    fits: true,
    plan_cop: 0,
    extra_users: 0,
    extra_user_unit_cop: null,
    extra_users_cop: 0,
    total_cop: 0,
    ...values,
  };
}

// Un equipo de diez personas: no cabe en Esencial, y en Firma paga dos adicionales.
const QUOTE = {
  users: 10,
  options: [
    option("essential", "Esencial", "monthly", {
      fits: false,
      plan_cop: 29_900,
      total_cop: 29_900,
    }),
    option("essential", "Esencial", "annual", {
      fits: false,
      plan_cop: 299_000,
      total_cop: 299_000,
    }),
    option("professional", "Profesional", "monthly", {
      included_users: 2,
      plan_cop: 59_900,
      extra_users: 8,
      extra_user_unit_cop: 19_900,
      extra_users_cop: 159_200,
      total_cop: 219_100,
    }),
    option("professional", "Profesional", "annual", {
      included_users: 2,
      plan_cop: 599_000,
      extra_users: 8,
      extra_user_unit_cop: 199_000,
      extra_users_cop: 1_592_000,
      total_cop: 2_191_000,
    }),
    option("firm", "Firma", "monthly", {
      included_users: 8,
      plan_cop: 149_900,
      extra_users: 2,
      extra_user_unit_cop: 14_900,
      extra_users_cop: 29_800,
      total_cop: 179_700,
    }),
    option("firm", "Firma", "annual", {
      included_users: 8,
      plan_cop: 1_499_000,
      extra_users: 2,
      extra_user_unit_cop: 149_000,
      extra_users_cop: 298_000,
      total_cop: 1_797_000,
    }),
  ],
};

const RECEIPT = {
  id: "01890a5d-ac96-774b-bcce-b302099a8099",
  number: "CP-2026-000007",
  issued_at: "2026-11-20T15:00:00Z",
  plan_name: "Firma",
  billing_cycle: "monthly",
  amount_cop: 179_700,
  extra_users: 2,
  extra_users_cop: 29_800,
  payment_method: "CARD",
  period_start: "2026-11-20T15:00:00Z",
  period_end: "2026-12-20T15:00:00Z",
  transaction_id: "tx-1",
};

function serve(onCheckout?: (body: unknown) => Response) {
  fetchMock.mockImplementation(async (input, init) => {
    const isRequest = typeof input !== "string";
    const url = isRequest ? (input as Request).url : String(input);
    const path = new URL(url, "http://localhost").pathname;
    const method = isRequest
      ? (input as Request).method
      : (init?.method ?? "GET");
    if (path === "/api/v1/me") return jsonResponse(ME);
    if (path === "/api/v1/plans") return jsonResponse(CATALOG);
    if (path === "/api/v1/billing/quote") return jsonResponse(QUOTE);
    if (path === "/api/v1/billing/receipts") return jsonResponse([RECEIPT]);
    if (path === "/api/v1/billing/payment-source")
      return jsonResponse({
        enabled: false,
        consent_version: "x",
        consent_text: "x",
        source: null,
      });
    if (
      path === "/api/v1/billing/checkout-web" &&
      method === "POST" &&
      onCheckout
    )
      return onCheckout(await (input as Request).json());
    throw new Error(`Ruta inesperada: ${method} ${path}`);
  });
}

describe("Plan y facturación con usuarios adicionales", () => {
  it("elige el primer plan donde cabe el equipo y muestra el desglose antes de pagar", async () => {
    serve();
    const user = userEvent.setup();
    const { container } = await renderRoute("/app/facturacion");

    const rows = await screen.findByLabelText("Valor a pagar");
    // Profesional es el primero donde cabe: ocho personas de más a $19.900.
    expect(
      within(rows).getByText("Plan Profesional, mensual"),
    ).toBeInTheDocument();
    expect(
      within(rows).getByText("8 usuarios adicionales"),
    ).toBeInTheDocument();
    expect(
      within(rows).getByText("$19.900 al mes cada uno"),
    ).toBeInTheDocument();
    expect(within(rows).getByText("$219.100")).toBeInTheDocument();
    expect(
      screen.getByText(/incluye a todo su equipo \(10 personas\)/),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Plan"), "firm");
    await user.click(screen.getByRole("radio", { name: /^Anual/ }));
    const annual = screen.getByLabelText("Valor a pagar");
    expect(
      within(annual).getByText("2 usuarios adicionales"),
    ).toBeInTheDocument();
    expect(
      within(annual).getByText("$149.000 al año cada uno"),
    ).toBeInTheDocument();
    expect(within(annual).getByText("$1.797.000")).toBeInTheDocument();
    expect(await seriousAxeViolations(container)).toEqual([]);
  });

  it("un plan donde no cabe el equipo lo explica y no deja pagarlo", async () => {
    serve();
    const user = userEvent.setup();
    await renderRoute("/app/facturacion");

    const plan = await screen.findByLabelText("Plan");
    expect(
      within(plan).getByRole("option", {
        name: "Esencial (no alcanza para su equipo)",
      }),
    ).toBeInTheDocument();
    await user.selectOptions(plan, "essential");

    expect(
      screen.getByText(
        /Su equipo tiene 10 personas, contando las invitaciones abiertas/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a pagar" })).toBeDisabled();
  });

  it("si el equipo creció antes de pagar, dice que recargue", async () => {
    serve(() =>
      jsonResponse({ type: "about:blank", status: 409, detail: "x" }, 409),
    );
    const user = userEvent.setup();
    await renderRoute("/app/facturacion");

    await user.click(await screen.findByRole("button", { name: "Ir a pagar" }));

    expect(
      await screen.findByText(/Su equipo ya no cabe en este plan/),
    ).toBeInTheDocument();
  });

  it("el comprobante dice cuántos usuarios adicionales se pagaron", async () => {
    serve();
    await renderRoute("/app/facturacion");

    const list = await screen.findByRole("list", {
      name: "Comprobantes de pago",
    });
    await waitFor(() =>
      expect(
        within(list).getByText(
          /plan Firma, mensual, con 2 usuarios adicionales/,
        ),
      ).toBeInTheDocument(),
    );
  });
});
