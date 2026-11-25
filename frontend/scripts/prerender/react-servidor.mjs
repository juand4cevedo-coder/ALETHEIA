// React para el prerender. Algunos ganchos llaman a useSyncExternalStore sin la lectura del
// servidor; en el build se toma la misma lectura del navegador simulado, que no tiene estado.
import * as React from "react";

export * from "react";
export default React;

export function useSyncExternalStore(
  subscribe,
  getSnapshot,
  getServerSnapshot,
) {
  return React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot ?? getSnapshot,
  );
}
