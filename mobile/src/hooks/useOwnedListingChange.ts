import { useCallback } from "react";
import { queryClient } from "../api/query-cache";
import { useAccountMarket, useCatalogue } from "../providers/Market";
export function useOwnedListingChange() {
  const { forgetProduct } = useCatalogue(), { store } = useAccountMarket();
  return useCallback(async (id: string) => {
    queryClient.removeQueries({ predicate: query => query.queryKey[0] === "listing" && query.queryKey[2] === id });
    await queryClient.invalidateQueries({ queryKey: ["owned-listing"], refetchType: "none" });
    await Promise.all([forgetProduct(id), store.forgetProduct(id)]);
  }, [forgetProduct, store]);
}
