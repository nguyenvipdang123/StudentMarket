import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { startMockMediaStorage } from "./helpers/mock-media-storage.mjs";

await mkdir(resolve("../.backups"), { recursive: true });
const dir = await mkdtemp(resolve("../.backups/media-unit-"));
Object.assign(process.env, { MEDIA_STORAGE_PROVIDER: "supabase", SUPABASE_URL: "https://media-tests.invalid", SUPABASE_SECRET_KEY: "sb_secret_storage_integration_test_only", PRODUCT_IMAGE_DIR: join(dir, "products"), STUDENT_CARD_DIR: join(dir, "cards"), CHAT_ATTACHMENT_DIR: join(dir, "chat"), SUPABASE_PRODUCT_BUCKET: "studentmarket-products", SUPABASE_CARD_BUCKET: "studentmarket-cards", SUPABASE_CHAT_BUCKET: "studentmarket-chat" });
const store = await import("../lib/media-storage.ts"), files = await import("../lib/media-files.ts");
const mock = await startMockMediaStorage(), actualFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(String(input));
  assert.ok(url.hostname.endsWith("-tests.invalid"), "No live storage calls are allowed in tests");
  assert.equal(init.redirect, "error"); assert.equal(init.headers.get("apikey"), mock.secret); assert.equal(init.headers.has("authorization"), false);
  return actualFetch(mock.origin + url.pathname, init);
};
after(() => { globalThis.fetch = actualFetch; mock.server.close(); });
const name = "12345678-1234-4234-8234-123456789abc.png", chatKey = "87654321-4321-4321-8321-987654321abc/" + name;
const png = Buffer.from([137,80,78,71,13,10,26,10]);

test("storage rejects public keys, unsafe URLs, duplicated buckets and unknown providers", () => {
  assert.deepEqual(store.missingMediaSettings(), []);
  const original = { ...process.env };
  for (const patch of [{ SUPABASE_SECRET_KEY: "sb_publishable_public_only", SUPABASE_SERVICE_ROLE_KEY: "" }, { SUPABASE_URL: "http://media-tests.invalid" }, { SUPABASE_URL: "https://media-tests.invalid/?secret=x" }, { SUPABASE_CARD_BUCKET: "studentmarket-products" }, { MEDIA_STORAGE_PROVIDER: "wrong" }]) {
    Object.assign(process.env, patch); assert.ok(store.missingMediaSettings().length); Object.assign(process.env, original);
  }
});
test("media keys and portable card references cannot traverse directories or cross conversation namespaces", () => {
  assert.equal(files.validMediaKey("products", name), true); assert.equal(files.validMediaKey("chat", chatKey), true);
  for (const key of ["../"+name,"/"+name,"other/"+name,"%2e%2e/"+name,name+"?x=1"])assert.equal(files.validMediaKey("products", key), false);
  assert.equal(files.validMediaKey("chat", "../"+chatKey), false);
  assert.equal(files.studentCardKey("media:cards/"+name), name);
  assert.equal(files.studentCardKey(files.mediaLocalPath("cards", name)), name);
  assert.equal(files.studentCardKey(resolve(dir,"outside",name)), null);
});
test("Supabase upload, read and deletion preserve bytes, isolate buckets and never create local files", async () => {
  for(const [kind,key]of [["products",name],["cards",name],["chat",chatKey]]) {
    await store.saveMedia(kind,key,png); assert.deepEqual(await store.readMedia(kind,key),png);
    await assert.rejects(access(files.mediaLocalPath(kind,key)));
    await assert.rejects(store.saveMedia(kind,key,png),e=>e.status===409);
  }
  await store.removeMedia("products",name);await assert.rejects(store.readMedia("products",name),e=>e.status===404);
  assert.ok(mock.objects.has("studentmarket-cards/"+name));assert.ok(mock.objects.has("studentmarket-chat/"+chatKey));
});
test("private bucket misconfiguration and provider outages fail closed without leaking secrets or falling back to disk", async () => {
  mock.buckets.set("studentmarket-cards",true);
  process.env.SUPABASE_URL="https://privacy-tests.invalid";
  await assert.rejects(store.saveMedia("cards",name,png),e=>e.status===503&&!e.message.includes(mock.secret));
  mock.buckets.set("studentmarket-cards",false);process.env.SUPABASE_URL="https://media-tests.invalid";
  mock.failNextUpload();
  await assert.rejects(store.saveMedia("products",name,png),e=>e.status===503&&!e.message.includes(mock.secret));
  await assert.rejects(access(files.mediaLocalPath("products",name)));
  await assert.rejects(store.saveMedia("products",name,Buffer.from("not an image")),e=>e.status===413);
});
test("local storage remains usable explicitly, keeps private file naming and removes only the requested object", async () => {
  process.env.MEDIA_STORAGE_PROVIDER="local";
  await store.saveMedia("products",name,png);assert.deepEqual(await store.readMedia("products",name),png);
  await store.removeMedia("products",name);await assert.rejects(store.readMedia("products",name),e=>e.status===404);
  process.env.MEDIA_STORAGE_PROVIDER="supabase";
});
test("local read fallback is opt-in during migration and never hides missing cloud data when disabled", async () => {
  process.env.MEDIA_STORAGE_PROVIDER="local";await store.saveMedia("products",name,png);
  process.env.MEDIA_STORAGE_PROVIDER="supabase";process.env.MEDIA_STORAGE_READ_LOCAL_FALLBACK="true";
  assert.deepEqual(await store.readMedia("products",name),png);
  await assert.rejects(store.readMedia("products",name,true),e=>e.status===404);
  process.env.MEDIA_STORAGE_READ_LOCAL_FALLBACK="false";
  await assert.rejects(store.readMedia("products",name),e=>e.status===404);
  process.env.MEDIA_STORAGE_PROVIDER="local";await store.removeMedia("products",name);process.env.MEDIA_STORAGE_PROVIDER="supabase";
});
