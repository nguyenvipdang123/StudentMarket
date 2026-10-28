import { draftMedia } from "../src/api/listing-draft-files.native";

const mockFiles = new Map<string, number>();
const mockFolders = new Set<string>();
const mockDeleted: string[] = [];
jest.mock("expo-file-system", () => {
  const path = (parts: (string | { uri: string })[]) => parts.map(p => typeof p === "string" ? p.replace(/\/$/, "") : p.uri.replace(/\/$/, "")).join("/");
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = path(parts); }
    get exists() { return mockFiles.has(this.uri); }
    get size() { return mockFiles.get(this.uri) || 0; }
    async copy(target: File) { if (!this.exists) throw Error("Missing source"); mockFiles.set(target.uri, this.size); }
    delete() { mockDeleted.push(this.uri); mockFiles.delete(this.uri); }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = path(parts) + "/"; }
    get exists() { return mockFolders.has(this.uri); }
    create() { mockFolders.add(this.uri); }
    list() { return [...mockFiles.keys()].filter(uri => uri.startsWith(this.uri) && !uri.slice(this.uri.length).includes("/")).map(uri => new File(uri)); }
  }
  return { File, Directory, Paths: { document: "file:///documents/", cache: "file:///cache/" } };
});
const photo = { uri: "file:///cache/photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg" as const, fileSize: 1024, width: 800, height: 600 };
beforeEach(() => { mockFiles.clear(); mockFolders.clear(); mockDeleted.length = 0; mockFiles.set(photo.uri, photo.fileSize); });

test("native copies compressed photos into Documents and restores after the cache disappears", async () => {
  const media = draftMedia("https://sangtay.shop:seller-a");
  const saved = await media.retain(photo);
  expect(saved.uri).toMatch(/^file:\/\/\/documents\/listing-drafts\//);
  expect(saved.uri).not.toBe(photo.uri);
  mockFiles.delete(photo.uri);
  const restarted = draftMedia("https://sangtay.shop:seller-a");
  expect(await restarted.inspect(saved)).toEqual(saved);
  expect(mockDeleted).toEqual([]);
});

test("cleanup deletes only detached copies belonging to the exact account/API folder", async () => {
  const a = draftMedia("https://sangtay.shop:seller-a"), b = draftMedia("https://sangtay.shop:seller-b");
  const first = await a.retain(photo), second = await a.retain(photo), other = await b.retain(photo);
  expect(await a.inspect(other)).toBeNull();
  const extra = first.uri.replace(/draft-[^/]+\.jpg$/, "keep-original.jpg"); mockFiles.set(extra, 10);
  await a.prune([second.uri]);
  expect(mockDeleted).toEqual([first.uri]);
  expect(mockFiles.has(other.uri)).toBe(true);
  expect(mockFiles.has(second.uri)).toBe(true);
  expect(mockFiles.has(photo.uri)).toBe(true);
  expect(mockFiles.has(extra)).toBe(true);
  mockFiles.delete(second.uri); expect(await a.inspect(second)).toBeNull();
});
