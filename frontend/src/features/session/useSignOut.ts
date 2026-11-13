import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import {
  signOutEverywhereMutation,
  signOutMutation,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { ROUTES } from "../../config/routes.ts";
import { forgetSession } from "./sessionHint.ts";

/** Qué sesiones se cerraron: la de este dispositivo o todas. */
export type SignOutScope = "device" | "everywhere";

/** Estado de navegación con el que la pantalla de ingreso confirma el cierre. */
export type SignedOutState = { signedOut: SignOutScope };

/** Qué aviso muestra la pantalla de ingreso según cómo se llegó a ella. */
export type SessionNotice = SignOutScope | "expired";

export function sessionNotice(state: unknown): SessionNotice | null {
  if (typeof state !== "object" || state === null) return null;
  const { signedOut, expired } = state as Partial<SignedOutState> & {
    expired?: unknown;
  };
  if (signedOut === "device" || signedOut === "everywhere") return signedOut;
  return expired === true ? "expired" : null;
}

function isUnauthorized(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 401
  );
}

// Cierre de sesión (API-009) y de todas las sesiones (API-010), HU-009. Al terminar se borra
// todo lo que la página guardaba de la cuenta y se lleva a ingresar, que confirma el cierre.
// Un 401 también es un cierre: la sesión ya había terminado y no queda nada que cerrar.
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const finish = (scope: SignOutScope) => {
    // Nada de la cuenta queda en la memoria de la página para quien use el equipo después.
    forgetSession();
    void queryClient.cancelQueries();
    queryClient.removeQueries();
    void navigate(ROUTES.signIn, {
      replace: true,
      state: { signedOut: scope } satisfies SignedOutState,
    });
  };

  const device = useMutation({
    ...signOutMutation(),
    onSuccess: () => finish("device"),
    onError: (error) => {
      if (isUnauthorized(error)) finish("device");
    },
  });

  const everywhere = useMutation({
    ...signOutEverywhereMutation(),
    onSuccess: () => finish("everywhere"),
    onError: (error) => {
      if (isUnauthorized(error)) finish("everywhere");
    },
  });

  const failed =
    (device.isError && !isUnauthorized(device.error)) ||
    (everywhere.isError && !isUnauthorized(everywhere.error));

  return {
    signOut: () => {
      everywhere.reset();
      device.mutate({});
    },
    signOutEverywhere: () => {
      device.reset();
      everywhere.mutate({});
    },
    pending: device.isPending
      ? ("device" as const)
      : everywhere.isPending
        ? ("everywhere" as const)
        : null,
    failed,
  };
}
