import { QueryClient } from "@tanstack/react-query";
// Server data is memory-only; query keys never contain cookies or secrets.
export const queryClient = new QueryClient({ defaultOptions: {
  queries: { retry: false, staleTime: 0, gcTime: 5 * 60 * 1000, refetchOnWindowFocus: false },
  mutations: { retry: false },
} });
export function fetchServerData<T>(scope: number, origin: string, path: string, fetcher: () => Promise<T>) {
  return queryClient.fetchQuery({ queryKey: ["api", scope, origin, path], queryFn: fetcher });
}
