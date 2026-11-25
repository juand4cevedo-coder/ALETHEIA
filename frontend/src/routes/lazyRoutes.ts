// Pantallas que se descargan aparte, solo cuando se abren (ADR-030). La página de inicio va en
// el paquete principal porque es la entrada más común; todo lo demás llega en su propio archivo.
// Las mismas funciones sirven para descargarlas por adelantado mientras el navegador está libre.
export const loadPricingPage = () =>
  import("../pages/PricingPage.tsx").then((module) => module.PricingPage);
export const loadLegalPage = () =>
  import("../pages/LegalPage.tsx").then((module) => module.LegalPage);
export const loadQueryRoot = () =>
  import("./QueryRoot.tsx").then((module) => module.QueryRoot);
export const loadAuthLayout = () =>
  import("../layouts/AuthLayout.tsx").then((module) => module.AuthLayout);
export const loadSignInPage = () =>
  import("../pages/SignInPage.tsx").then((module) => module.SignInPage);
export const loadSignUpPage = () =>
  import("../pages/SignUpPage.tsx").then((module) => module.SignUpPage);
export const loadSignUpWithEmailPage = () =>
  import("../pages/SignUpWithEmailPage.tsx").then(
    (module) => module.SignUpWithEmailPage,
  );
export const loadVerifyEmailPage = () =>
  import("../pages/VerifyEmailPage.tsx").then(
    (module) => module.VerifyEmailPage,
  );
export const loadForgotPasswordPage = () =>
  import("../pages/ForgotPasswordPage.tsx").then(
    (module) => module.ForgotPasswordPage,
  );
export const loadResetPasswordPage = () =>
  import("../pages/ResetPasswordPage.tsx").then(
    (module) => module.ResetPasswordPage,
  );
export const loadRecoverTwoFactorPage = () =>
  import("../pages/RecoverTwoFactorPage.tsx").then(
    (module) => module.RecoverTwoFactorPage,
  );
export const loadClientPortalPage = () =>
  import("../pages/ClientPortalPage.tsx").then(
    (module) => module.ClientPortalPage,
  );
export const loadAppShell = () =>
  import("../layouts/AppShell.tsx").then((module) => module.AppShell);
export const loadWorkspacePage = () =>
  import("../pages/WorkspacePage.tsx").then((module) => module.WorkspacePage);
export const loadAccountPage = () =>
  import("../pages/AccountPage.tsx").then((module) => module.AccountPage);
// Consola de la plataforma: un solo archivo de entrada que reparte sus pantallas.
export const loadPlatformConsole = () =>
  import("./PlatformConsole.tsx").then((module) => module.PlatformConsole);
export const loadSupportPage = () =>
  import("../pages/SupportPage.tsx").then((module) => module.SupportPage);
export const loadAcceptInvitationPage = () =>
  import("../pages/AcceptInvitationPage.tsx").then(
    (module) => module.AcceptInvitationPage,
  );
export const loadMembersPage = () =>
  import("../pages/MembersPage.tsx").then((module) => module.MembersPage);
export const loadOrganizationPage = () =>
  import("../pages/OrganizationPage.tsx").then(
    (module) => module.OrganizationPage,
  );
export const loadCalendarPage = () =>
  import("../pages/CalendarPage.tsx").then((module) => module.CalendarPage);
export const loadTaskTemplatesPage = () =>
  import("../pages/TaskTemplatesPage.tsx").then(
    (module) => module.TaskTemplatesPage,
  );
export const loadOrganizationAuditPage = () =>
  import("../pages/OrganizationAuditPage.tsx").then(
    (module) => module.OrganizationAuditPage,
  );
export const loadCasesPage = () =>
  import("../pages/CasesPage.tsx").then((module) => module.CasesPage);
export const loadBillingPage = () =>
  import("../pages/BillingPage.tsx").then((module) => module.BillingPage);
export const loadArchivePage = () =>
  import("../pages/ArchivePage.tsx").then((module) => module.ArchivePage);
export const loadNewCasePage = () =>
  import("../pages/NewCasePage.tsx").then((module) => module.NewCasePage);
export const loadCasePage = () =>
  import("../pages/CasePage.tsx").then((module) => module.CasePage);
export const loadEvidenceDetailPage = () =>
  import("../pages/EvidenceDetailPage.tsx").then(
    (module) => module.EvidenceDetailPage,
  );

// Lo que alguien abre casi siempre después del inicio: precios, ingresar y crear cuenta (con el
// proveedor de consultas que las envuelve).
const LIKELY_NEXT = [
  loadPricingPage,
  loadQueryRoot,
  loadAuthLayout,
  loadSignInPage,
  loadSignUpPage,
] as const;

/** Descarga por adelantado las pantallas más probables cuando el navegador queda libre, para
 * que al hacer clic aparezcan sin espera. En conexiones con ahorro de datos no descarga nada. */
export function prefetchLikelyNext(): () => void {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (connection?.saveData) return () => {};
  const run = () => {
    for (const load of LIKELY_NEXT) void load().catch(() => {});
  };
  // Safari todavía no tiene requestIdleCallback: ahí basta una espera corta.
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout: 4000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(run, 1500);
  return () => window.clearTimeout(handle);
}

/** Quien ya tiene sesión casi siempre va de la página pública a su espacio de trabajo. Con el
 * navegador desocupado se descargan sus piezas más usadas, así el clic en «Ir a mis casos» no
 * espera la red. No se ejecuta nada: solo se calienta la caché de módulos. */
export function prefetchWorkspace(): void {
  const warm = () => {
    void loadQueryRoot();
    void loadAppShell();
    void loadWorkspacePage();
    void loadCasesPage();
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(warm, { timeout: 4000 });
  } else {
    setTimeout(warm, 2000);
  }
}
