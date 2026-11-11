import { useCallback, useSyncExternalStore } from "react";

/** Si la consulta de medios se cumple ahora; se actualiza al cambiar el tamaño de la ventana.
 * Sin matchMedia (pruebas, navegadores muy viejos) responde false. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia?.(query);
      if (!list?.addEventListener) return () => {};
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
