import { Navigate, Outlet, useOutletContext } from "react-router";

import type { Me } from "../api/generated";
import { ROUTES } from "../config/routes.ts";

/** Mantiene los expedientes fuera de la consola de administración de plataforma. */
export function CaseAccessGuard() {
  const me = useOutletContext<Me>();
  if (me.platform_admin) return <Navigate to={ROUTES.platform} replace />;
  return <Outlet context={me} />;
}
