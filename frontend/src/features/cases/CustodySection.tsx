import { useInfiniteQuery } from "@tanstack/react-query";

import { listCustodyEventsInfiniteOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { CustodyTimeline } from "./CustodyTimeline.tsx";

export function CustodySection({
  caseId,
  justOpened,
}: {
  caseId: string;
  justOpened: boolean;
}) {
  const listing = useInfiniteQuery({
    ...listCustodyEventsInfiniteOptions({ path: { case_id: caseId } }),
    initialPageParam: { path: { case_id: caseId }, query: { limit: 20 } },
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
  const events = listing.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      {listing.isPending && <p role="status">Cargando cadena de custodia</p>}
      {listing.isError && (
        <Notice tone="error">
          <p>No pudimos consultar la cadena de custodia.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void listing.refetch()}
          >
            Intentar de nuevo
          </Button>
        </Notice>
      )}
      {events.length > 0 && (
        <CustodyTimeline events={events} justOpened={justOpened} />
      )}
      {listing.hasNextPage && (
        <Button
          variant="secondary"
          size="sm"
          disabled={listing.isFetchingNextPage}
          onClick={() => void listing.fetchNextPage()}
        >
          {listing.isFetchingNextPage
            ? "Cargando más"
            : "Ver eventos anteriores"}
        </Button>
      )}
    </>
  );
}
