import { useSyncExternalStore } from "react";

import {
  type CookieChoice,
  readCookieChoice,
  subscribeToCookieChoice,
} from "./cookieConsent.ts";

/** La elección vigente sobre cookies; el componente se vuelve a pintar cuando cambia. */
export function useCookieChoice(): CookieChoice | null {
  return useSyncExternalStore(subscribeToCookieChoice, readCookieChoice);
}
