import { fetchServerData, queryClient } from "../src/api/query-cache";
afterEach(() => queryClient.clear());
test("server library deduplicates concurrent reads but isolates account scopes", async () => {
  let complete!: (value: { title: string }) => void;
  const fetcher = jest.fn(() => new Promise<{ title: string }>(resolve => { complete = resolve; }));
  const a = fetchServerData(1, "https://sangtay.shop", "/api/products", fetcher);
  const b = fetchServerData(1, "https://sangtay.shop", "/api/products", fetcher);
  complete({ title: "Bàn học" });
  expect(await a).toEqual(await b);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await fetchServerData(2, "https://sangtay.shop", "/api/products", async () => ({ title: "Món khác" }))).toEqual({ title: "Món khác" });
  expect(queryClient.getQueryCache().getAll()).toHaveLength(2);
});
test("failed reads are not silently retried, and clearing session cache drops private server data", async () => {
  const fail = jest.fn(async () => { throw Error("401 fixture"); });
  await expect(fetchServerData(1, "https://sangtay.shop", "/api/favorites", fail)).rejects.toThrow("401 fixture");
  expect(fail).toHaveBeenCalledTimes(1);
  queryClient.clear();
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});
