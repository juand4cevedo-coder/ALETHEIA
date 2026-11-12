import {
  QueryClientContext,
  QueryClientProvider,
  type QueryClient,
} from "@tanstack/react-query";
import { useContext } from "react";
import { Outlet } from "react-router";

import { createQueryClient } from "../api/queryClient.ts";

// TanStack Query y el cliente generado solo los usan el acceso y el espacio de trabajo. Este
// marco los envuelve y llega en el mismo archivo aparte que ellos, así la landing no los
// descarga (presupuesto de carga, especificación de identidad, sección 8).
let appClient: QueryClient | undefined;

function sharedClient(): QueryClient {
  // Una respuesta se considera vigente un minuto, lo mismo que la API permite guardarla.
  appClient ??= createQueryClient({
    queries: { staleTime: 60_000, retry: 2 },
  });
  return appClient;
}

/** Da a las pantallas hijas el cliente de consultas de la aplicación, que se crea la primera
 * vez y se conserva al ir y volver entre el acceso y el espacio de trabajo. Si ya hay uno más
 * arriba, como en las pruebas, usa ese. */
export function QueryRoot() {
  const outer = useContext(QueryClientContext);
  if (outer) return <Outlet />;
  return (
    <QueryClientProvider client={sharedClient()}>
      <Outlet />
    </QueryClientProvider>
  );
}
