import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { LEGAL_VERSION } from "../config/legal.ts";
import { jsonResponse, renderRoute } from "../test/render.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function ownerEnPrueba() {
  return {
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
    },
    subscription: {
      plan_name: "Esencial",
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
}

it("permite a la propietaria en prueba pagar el plan con Nequi", async () => {
  let checkoutBody: Record<string, unknown> | null = null;
  fetchMock.mockImplementation(async (input, init) => {
    // El catálogo de planes (catalog.tsx) llama a fetch con una URL relativa en texto, no con
    // un Request; Node no la resuelve sin una base. El resto de llamadas sí pasan un Request
    // ya armado por el cliente generado.
    const isRequest = typeof input !== "string";
    const url = isRequest ? (input as Request).url : input;
    const path = new URL(url, "http://localhost").pathname;
    const method = isRequest
      ? (input as Request).method
      : (init?.method ?? "GET");
    const json = async () =>
      isRequest
        ? ((input as Request).json() as Promise<unknown>)
        : JSON.parse(String(init?.body));
    if (path === "/api/v1/me") return jsonResponse(ownerEnPrueba());
    if (path === "/api/v1/plans")
      return jsonResponse([
        {
          code: "essential",
          name: "Esencial",
          monthly_price_cop: 29_900,
          annual_price_cop: 299_000,
          included_users: 3,
          extra_user_price_cop: null,
          storage_limit_bytes: 1024 ** 3,
          max_file_bytes: 1024 ** 3,
          trial_days: 14,
          is_public: true,
        },
      ]);
    if (path === "/api/v1/billing/wompi-terms")
      return jsonResponse({
        acceptance_token: "token-acc",
        acceptance_permalink: "https://wompi.co/terminos",
        accept_personal_auth: "token-datos",
        personal_auth_permalink: "https://wompi.co/datos",
      });
    if (path === "/api/v1/billing/checkout" && method === "POST") {
      checkoutBody = (await json()) as Record<string, unknown>;
      return jsonResponse({
        transaction_id: "tx-1",
        reference: "aletheia:org:essential:monthly:nonce",
        status: "PENDING",
      });
    }
    throw new Error(`Ruta inesperada: ${method} ${path}`);
  });
  const user = userEvent.setup();
  await renderRoute("/app/cuenta");

  await user.click(
    await screen.findByRole("radio", { name: /Nequi, con una notificación/ }),
  );
  await user.type(await screen.findByLabelText("Celular Nequi"), "3001234567");
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  await user.click(
    await screen.findByRole("checkbox", {
      name: /términos de uso de Wompi/,
    }),
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: /tratamiento de mis datos personales/,
    }),
  );
  await user.click(screen.getByRole("button", { name: "Pagar con Nequi" }));

  expect(
    await screen.findByText(/Enviamos el cobro a su Nequi/),
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(checkoutBody).toMatchObject({
      plan_code: "essential",
      billing_cycle: "monthly",
      phone_number: "3001234567",
      acceptance_token: "token-acc",
      accept_personal_auth: "token-datos",
    });
  });
});

it("cierra la cuenta solo después de una confirmación explícita", async () => {
  let closureBody: Record<string, unknown> | null = null;
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me") return jsonResponse(ownerEnPrueba());
    if (path === "/api/v1/auth/google/status")
      return jsonResponse({ configured: false });
    if (path === "/api/v1/me/account/closure" && request.method === "POST") {
      closureBody = (await request.json()) as Record<string, unknown>;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Ruta inesperada: ${request.method} ${path}`);
  });
  const user = userEvent.setup();
  await renderRoute("/app/cuenta");

  await user.click(
    await screen.findByRole("button", { name: "Cerrar mi cuenta" }),
  );
  expect(
    screen.getByText(/Los casos, evidencias, aceptaciones/),
  ).toBeInTheDocument();
  await user.type(
    screen.getByLabelText("Confirme su contraseña actual"),
    "clave-segura",
  );
  await user.type(screen.getByLabelText(/Para confirmar/), "CERRAR MI CUENTA");
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Cerrar mi cuenta",
    }),
  );

  expect(
    await screen.findByText(/Su cuenta quedó cerrada/),
  ).toBeInTheDocument();
  expect(closureBody).toEqual({
    password: "clave-segura",
    confirmation: "CERRAR MI CUENTA",
  });
});

it("confirma el pago con Nequi cuando la suscripción queda activa", async () => {
  let active = false;
  fetchMock.mockImplementation(async (input, init) => {
    const isRequest = typeof input !== "string";
    const url = isRequest ? (input as Request).url : input;
    const path = new URL(url, "http://localhost").pathname;
    const method = isRequest
      ? (input as Request).method
      : (init?.method ?? "GET");
    if (path === "/api/v1/me")
      return jsonResponse(
        active
          ? {
              ...ownerEnPrueba(),
              subscription: {
                ...ownerEnPrueba().subscription,
                status: "active",
              },
            }
          : ownerEnPrueba(),
      );
    if (path === "/api/v1/plans")
      return jsonResponse([
        {
          code: "essential",
          name: "Esencial",
          monthly_price_cop: 29_900,
          annual_price_cop: 299_000,
          included_users: 3,
          extra_user_price_cop: null,
          storage_limit_bytes: 1024 ** 3,
          max_file_bytes: 1024 ** 3,
          trial_days: 14,
          is_public: true,
        },
      ]);
    if (path === "/api/v1/billing/wompi-terms")
      return jsonResponse({
        acceptance_token: "token-acc",
        acceptance_permalink: "https://wompi.co/terminos",
        accept_personal_auth: "token-datos",
        personal_auth_permalink: "https://wompi.co/datos",
      });
    if (path === "/api/v1/billing/checkout" && method === "POST") {
      return jsonResponse({
        transaction_id: "tx-1",
        reference: "aletheia:org:essential:monthly:nonce",
        status: "PENDING",
      });
    }
    throw new Error(`Ruta inesperada: ${method} ${path}`);
  });
  const user = userEvent.setup();
  await renderRoute("/app/cuenta");

  await user.click(
    await screen.findByRole("radio", { name: /Nequi, con una notificación/ }),
  );
  await user.type(await screen.findByLabelText("Celular Nequi"), "3001234567");
  await user.click(screen.getByRole("button", { name: "Continuar" }));

  await user.click(
    await screen.findByRole("checkbox", {
      name: /términos de uso de Wompi/,
    }),
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: /tratamiento de mis datos personales/,
    }),
  );
  await user.click(screen.getByRole("button", { name: "Pagar con Nequi" }));

  await screen.findByText(/Enviamos el cobro a su Nequi/);

  // La aprobación llegó del lado de Nequi: la siguiente consulta de /me ya la refleja.
  active = true;
  expect(
    await screen.findByText(/Su pago quedó aprobado/, undefined, {
      timeout: 10_000,
    }),
  ).toBeInTheDocument();
}, 15_000);

it("no muestra el pago con Nequi a quien no administra la facturación", async () => {
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me")
      return jsonResponse({
        ...ownerEnPrueba(),
        permissions: [],
        organization: {
          id: "01890a5d-ac96-774b-bcce-b302099a8059",
          name: "Restrepo Abogados",
          role: "lawyer",
        },
      });
    throw new Error(`Ruta inesperada: ${request.method} ${path}`);
  });
  await renderRoute("/app/cuenta");

  await screen.findByText("Esencial");
  expect(screen.queryByLabelText("Celular Nequi")).not.toBeInTheDocument();
});

it("activa la verificación en dos pasos y muestra los códigos de respaldo una sola vez", async () => {
  let enabled = false;
  let sent: unknown;
  fetchMock.mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    if (path === "/api/v1/me") return jsonResponse(ownerEnPrueba());
    if (path === "/api/v1/account/two-factor/setup") {
      return jsonResponse({
        secret: "JBSWY3DPEHPK3PXP",
        uri: "otpauth://totp/ALETHEIA%3Aana%40example.com?secret=JBSWY3DPEHPK3PXP",
      });
    }
    if (path === "/api/v1/account/two-factor/enable") {
      sent = await request.json();
      enabled = true;
      return jsonResponse({ recovery_codes: ["ABCDE-FGHJK", "23456-789MN"] });
    }
    if (path === "/api/v1/account/two-factor") {
      return jsonResponse({
        enabled,
        recovery_codes_remaining: enabled ? 2 : 0,
      });
    }
    if (path === "/api/v1/plans") return jsonResponse({ items: [] });
    throw new Error(`Ruta inesperada: ${path}`);
  });
  const user = userEvent.setup();
  await renderRoute("/app/cuenta");

  await user.click(
    await screen.findByRole("button", {
      name: "Activar la verificación en dos pasos",
    }),
  );
  expect(screen.getByLabelText("Clave de configuración")).toHaveTextContent(
    "JBSW Y3DP EHPK 3PXP",
  );
  // El QR se dibuja en el navegador con el mismo enlace; no sale de la pantalla.
  expect(await screen.findByAltText(/Código QR/)).toHaveAttribute(
    "src",
    expect.stringMatching(/^data:image\/gif;base64,/),
  );
  await user.type(screen.getByLabelText("Código de la aplicación"), "123456");
  await user.click(screen.getByRole("button", { name: "Confirmar y activar" }));

  const codes = await screen.findByRole("list", {
    name: "Códigos de respaldo",
  });
  expect(within(codes).getByText("ABCDE-FGHJK")).toBeInTheDocument();
  expect(sent).toEqual({ code: "123456" });

  await user.click(screen.getByRole("button", { name: "Ya los guardé" }));
  expect(screen.queryByText("ABCDE-FGHJK")).toBeNull();
  expect(
    await screen.findByText(/está activa. Le quedan 2 códigos de respaldo/),
  ).toBeInTheDocument();
});

const PLANS = [
  {
    code: "essential",
    name: "Esencial",
    monthly_price_cop: 29_900,
    annual_price_cop: 299_000,
    included_users: 3,
    extra_user_price_cop: null,
    storage_limit_bytes: 1024 ** 3,
    max_file_bytes: 1024 ** 3,
    trial_days: 14,
    is_public: true,
  },
];

function serveCheckoutWeb(handlers: {
  web?: (body: Record<string, unknown>) => Response;
  confirm?: () => Response;
}) {
  fetchMock.mockImplementation(async (input, init) => {
    const isRequest = typeof input !== "string";
    const url = isRequest ? (input as Request).url : input;
    const path = new URL(url, "http://localhost").pathname;
    const method = isRequest
      ? (input as Request).method
      : (init?.method ?? "GET");
    if (path === "/api/v1/me") return jsonResponse(ownerEnPrueba());
    if (path === "/api/v1/plans") return jsonResponse(PLANS);
    if (path === "/api/v1/auth/google/status")
      return jsonResponse({ configured: false });
    if (path === "/api/v1/billing/checkout-web" && method === "POST")
      return handlers.web!(
        (await (input as Request).json()) as Record<string, unknown>,
      );
    if (path === "/api/v1/billing/checkout-web/confirm" && method === "POST")
      return handlers.confirm!();
    throw new Error(`Ruta inesperada: ${method} ${path}`);
  });
}

it("por omisión paga en la página de Wompi con tarjeta, PSE u otros medios", async () => {
  let body: Record<string, unknown> | null = null;
  serveCheckoutWeb({
    web: (sent) => {
      body = sent;
      return jsonResponse({
        checkout_url: "https://checkout.wompi.co/p/?public-key=pub_test_x",
      });
    },
  });
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
  const user = userEvent.setup();
  await renderRoute("/app/cuenta");

  expect(
    await screen.findByRole("radio", { name: /Tarjeta, PSE u otros medios/ }),
  ).toBeChecked();
  expect(screen.queryByLabelText("Celular Nequi")).not.toBeInTheDocument();
  expect(screen.getByText(/ALETHEIA nunca los ve/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ir a pagar" }));

  await waitFor(() =>
    expect(assign).toHaveBeenCalledWith(
      "https://checkout.wompi.co/p/?public-key=pub_test_x",
    ),
  );
  expect(body).toEqual({ plan_code: "essential", billing_cycle: "monthly" });
  vi.unstubAllGlobals();
});

it("al volver de Wompi confirma el pago con el servidor y dice que quedó aprobado", async () => {
  let confirmations = 0;
  serveCheckoutWeb({
    confirm: () => {
      confirmations += 1;
      return jsonResponse({ status: "APPROVED" });
    },
  });
  await renderRoute("/app/cuenta?id=1292-1602113476-10985");

  expect(
    await screen.findByText("Su pago quedó aprobado y el plan ya está activo."),
  ).toBeInTheDocument();
  expect(confirmations).toBe(1);
});

it("si el pago no se completó lo dice y deja intentarlo de nuevo", async () => {
  serveCheckoutWeb({ confirm: () => jsonResponse({ status: "DECLINED" }) });
  const user = userEvent.setup();
  await renderRoute("/app/cuenta?id=1292-1602113476-10985");

  expect(await screen.findByText(/El pago no se completó/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Intentar de nuevo" }));

  expect(
    await screen.findByRole("button", { name: "Ir a pagar" }),
  ).toBeInTheDocument();
});

it("un pago pendiente, como PSE, se sigue consultando y avisa que puede tardar", async () => {
  serveCheckoutWeb({ confirm: () => jsonResponse({ status: "PENDING" }) });
  await renderRoute("/app/cuenta?id=1292-1602113476-10985");

  expect(await screen.findByText(/Con PSE puede tardar/)).toBeInTheDocument();
});
