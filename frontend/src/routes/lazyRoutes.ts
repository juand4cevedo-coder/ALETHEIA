// Pantallas que se descargan aparte, solo cuando se abren (ADR-030). La página de inicio va en
// el paquete principal porque es la entrada más común; todo lo demás llega en su propio archivo.
// Las mismas funciones sirven para descargarlas por adelantado mientras el navegador está libre.
export const loadPricingPage = () =>
  import("../pages/PricingPage.tsx").then((module) => module.PricingPage);
export const loadLegalPage = () =>
  import("../pages/LegalPage.tsx").then((module) => module.LegalPage);
export const loadAuthLayout = () =>
  import("../layouts/AuthLayout.tsx").then((module) => module.AuthLayout);
export const loadSignInPage = () =>
  import("../pages/SignInPage.tsx").then((module) => module.SignInPage);
export const loadSignUpPage = () =>
  import("../pages/SignUpPage.tsx").then((module) => module.SignUpPage);
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
export const loadAppShell = () =>
  import("../layouts/AppShell.tsx").then((module) => module.AppShell);
export const loadWorkspacePage = () =>
  import("../pages/WorkspacePage.tsx").then((module) => module.WorkspacePage);
export const loadAccountPage = () =>
  import("../pages/AccountPage.tsx").then((module) => module.AccountPage);
export const loadAcceptInvitationPage = () =>
  import("../pages/AcceptInvitationPage.tsx").then(
    (module) => module.AcceptInvitationPage,
  );
export const loadMembersPage = () =>
  import("../pages/MembersPage.tsx").then((module) => module.MembersPage);
export const loadNewCasePage = () =>
  import("../pages/NewCasePage.tsx").then((module) => module.NewCasePage);
export const loadCasePage = () =>
  import("../pages/CasePage.tsx").then((module) => module.CasePage);

// Lo que alguien abre casi siempre después del inicio: precios, ingresar y crear cuenta.
const LIKELY_NEXT = [
  loadPricingPage,
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
