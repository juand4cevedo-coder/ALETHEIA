import {
  type DefaultOptions,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";

import { isLegalAcceptanceRequired } from "../features/legal/acceptance.ts";
import { readMeQueryKey } from "./generated/@tanstack/react-query.gen.ts";

/**
 * Cliente de TanStack Query de toda la aplicación. Si cualquier petición responde que faltan
 * por aceptar los textos legales vigentes, se vuelve a pedir el perfil: el espacio de trabajo
 * lo lee y muestra los textos nuevos en lugar de un error (TT-012).
 */
export function createQueryClient(defaultOptions: DefaultOptions): QueryClient {
  const onError = (error: unknown) => {
    if (isLegalAcceptanceRequired(error)) {
      void client.invalidateQueries({ queryKey: readMeQueryKey() });
    }
  };
  const client: QueryClient = new QueryClient({
    defaultOptions,
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
  });
  return client;
}
