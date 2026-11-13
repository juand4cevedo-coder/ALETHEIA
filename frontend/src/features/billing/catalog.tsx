// Contexto y hook en un mismo módulo: la recarga en caliente no aplica a este archivo.
/* oxlint-disable react/only-export-components */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type { PublicPlan } from "../../api/generated";
import { SAME_ORIGIN_HEADER } from "../../api/sameOrigin.ts";

// Catálogo público de planes (GET /api/v1/plans, RN-019) para el inicio y la página de precios.
// Se pide con fetch y no con el cliente generado ni TanStack Query: así la landing no descarga
// ese código, que solo necesita el espacio de trabajo (presupuesto de carga, especificación de
// identidad, sección 8). El navegador puede guardar la respuesta un minuto, como permite la API.
const PLANS_URL = "/api/v1/plans";

export type PlanCatalog = {
  plans: PublicPlan[] | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
};

const PlanCatalogContext = createContext<PlanCatalog | null>(null);

async function fetchPlans(signal: AbortSignal): Promise<PublicPlan[]> {
  const response = await fetch(PLANS_URL, {
    headers: { Accept: "application/json", [SAME_ORIGIN_HEADER]: "1" },
    signal,
  });
  if (!response.ok) throw new Error(`El catálogo respondió ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error("El catálogo no trajo una lista");
  return body as PublicPlan[];
}

type State = {
  plans: PublicPlan[] | undefined;
  failed: boolean;
  fetching: boolean;
};

/** Pide el catálogo una sola vez para toda la página: el titular, las tarjetas y el cierre
 * leen la misma respuesta. Si falla, cada parte lo dice y el botón de reintento lo vuelve a
 * pedir. */
export function PlanCatalogProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({
    plans: undefined,
    failed: false,
    fetching: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchPlans(controller.signal).then(
      (plans) => setState({ plans, failed: false, fetching: false }),
      () => {
        if (controller.signal.aborted) return;
        setState((current) => ({ ...current, failed: true, fetching: false }));
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const refetch = useCallback(() => {
    setState((current) => ({ ...current, fetching: true }));
    setAttempt((value) => value + 1);
  }, []);
  const catalog: PlanCatalog = {
    plans: state.plans,
    isPending: state.plans === undefined && !state.failed,
    isError: state.plans === undefined && state.failed,
    isFetching: state.fetching,
    refetch,
  };

  return (
    <PlanCatalogContext.Provider value={catalog}>
      {children}
    </PlanCatalogContext.Provider>
  );
}

/** Catálogo de la página. Solo funciona dentro de PlanCatalogProvider. */
export function usePlanCatalog(): PlanCatalog {
  const catalog = useContext(PlanCatalogContext);
  if (!catalog) {
    throw new Error("usePlanCatalog necesita un PlanCatalogProvider");
  }
  return catalog;
}
