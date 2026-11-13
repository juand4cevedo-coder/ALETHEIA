// Lectura de un error de la API generada. Si la red falla, el error no trae status: se trata
// como una falla inesperada.

export type ApiProblem = {
  status?: number;
  /** Tipo de Problem Details; about:blank salvo los problemas que la interfaz distingue. */
  type?: string;
  detail?: string;
  requestId?: string;
};

export function apiProblem(error: unknown): ApiProblem {
  if (typeof error !== "object" || error === null) return {};
  const value = error as {
    status?: unknown;
    type?: unknown;
    detail?: unknown;
    request_id?: unknown;
  };
  return {
    status: typeof value.status === "number" ? value.status : undefined,
    type: typeof value.type === "string" ? value.type : undefined,
    detail: typeof value.detail === "string" ? value.detail : undefined,
    requestId:
      typeof value.request_id === "string" ? value.request_id : undefined,
  };
}
