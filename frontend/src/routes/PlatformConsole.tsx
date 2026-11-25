import { type ComponentType, lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

import { ROUTES } from "../config/routes.ts";
import { NotFoundPage } from "../pages/NotFoundPage.tsx";

// Consola de la plataforma: una sola entrada en el enrutador principal y, dentro, una pantalla
// por archivo que se descarga al abrirla. Así la portada no carga la lista de las nueve.
const page = <K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) => lazy(() => load().then((module) => ({ default: module[name] })));

const Overview = page(
  () => import("../pages/platform/PlatformOverviewPage.tsx"),
  "PlatformOverviewPage",
);
const Organizations = page(
  () => import("../pages/platform/PlatformOrganizationsPage.tsx"),
  "PlatformOrganizationsPage",
);
const Accounts = page(
  () => import("../pages/platform/PlatformAccountsPage.tsx"),
  "PlatformAccountsPage",
);
const Plans = page(
  () => import("../pages/platform/PlatformPlansPage.tsx"),
  "PlatformPlansPage",
);
const Billing = page(
  () => import("../pages/platform/PlatformBillingPage.tsx"),
  "PlatformBillingPage",
);
const Support = page(
  () => import("../pages/platform/PlatformSupportPage.tsx"),
  "PlatformSupportPage",
);
const Operations = page(
  () => import("../pages/platform/PlatformOperationsPage.tsx"),
  "PlatformOperationsPage",
);
const Audit = page(
  () => import("../pages/platform/PlatformAuditPage.tsx"),
  "PlatformAuditPage",
);
const Vitals = page(
  () => import("../pages/platform/PlatformVitalsPage.tsx"),
  "PlatformVitalsPage",
);

/** Ruta relativa a /app/plataforma. */
const child = (route: string) => route.slice(ROUTES.platform.length + 1);

export function PlatformConsole() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route index element={<Overview />} />
        <Route
          path={child(ROUTES.platformOrganizations)}
          element={<Organizations />}
        />
        <Route path={child(ROUTES.platformAccounts)} element={<Accounts />} />
        <Route path={child(ROUTES.platformPlans)} element={<Plans />} />
        <Route path={child(ROUTES.platformBilling)} element={<Billing />} />
        <Route path={child(ROUTES.platformSupport)} element={<Support />} />
        <Route
          path={child(ROUTES.platformOperations)}
          element={<Operations />}
        />
        <Route path={child(ROUTES.platformAudit)} element={<Audit />} />
        <Route path={child(ROUTES.platformVitals)} element={<Vitals />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
