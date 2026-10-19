import { createServer } from "node:http";

export async function startMockMediaStorage() {
  const secret = "sb_secret_storage_integration_test_only", objects = new Map();
  const buckets = new Map([["studentmarket-products", true], ["studentmarket-cards", false], ["studentmarket-chat", false]]);
  let failUpload = false;
  const server = createServer(async (request, response) => {
    const parts = new URL(request.url, "http://localhost").pathname.split("/").filter(Boolean);
    const send = (status, body) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(body)); };
    const publicRead = request.method === "GET" && parts[3] === "public";
    if (!publicRead && request.headers.apikey !== secret) return send(401, { error: "Unauthorized" });
    if (parts[0] !== "storage" || parts[1] !== "v1") return send(404, {});
    if (parts[2] === "bucket") {
      const name = parts[3];
      if (!buckets.has(name)) return send(404, { statusCode: "404" });
      return send(200, { id: name, name, public: buckets.get(name), file_size_limit: 5242880 });
    }
    if (parts[2] !== "object") return send(404, {});
    if (request.method === "GET") {
      const bucket = parts[4], key = parts.slice(5).join("/");
      if (publicRead && !buckets.get(bucket)) return send(403, { error: "Private bucket" });
      const bytes = objects.get(bucket + "/" + key);
      if (!bytes) return send(404, { statusCode: "404" });
      response.writeHead(200, { "Content-Type": key.endsWith("png") ? "image/png" : "image/jpeg", "Content-Length": bytes.length }); response.end(bytes); return;
    }
    let raw = Buffer.alloc(0); for await (const chunk of request) raw = Buffer.concat([raw, chunk]);
    const bucket = parts[3], key = parts.slice(4).join("/");
    if (!buckets.has(bucket)) return send(404, {});
    if (request.method === "POST") {
      if (failUpload) { failUpload = false; return send(503, { error: "Test upload unavailable" }); }
      const identity = bucket + "/" + key;
      if (objects.has(identity) && request.headers["x-upsert"] !== "true") return send(409, { error: "Duplicate" });
      objects.set(identity, raw); return send(200, { Key: identity });
    }
    if (request.method === "DELETE") {
      const { prefixes } = JSON.parse(raw.toString());
      for (const item of prefixes) objects.delete(bucket + "/" + item);
      return send(200, []);
    }
    return send(405, {});
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { server, origin: "http://127.0.0.1:" + server.address().port, secret, objects, buckets, failNextUpload() { failUpload = true; } };
}
