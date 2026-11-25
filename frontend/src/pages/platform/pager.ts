import { useState } from "react";

/** Paginación hacia atrás y hacia adelante sobre una lista con cursor. */
export function useCursorPager() {
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  return {
    cursor,
    reset() {
      setCursor(undefined);
      setPrevious([]);
    },
    back() {
      setCursor(previous.at(-1));
      setPrevious((items) => items.slice(0, -1));
    },
    forward(next: string) {
      setPrevious((items) => [...items, cursor]);
      setCursor(next);
    },
    hasPrevious: previous.length > 0,
  };
}
