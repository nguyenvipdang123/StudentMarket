import { createServer } from "node:http";
export async function startMockAssistant() {
  const calls = []; let ready = false;
  const server = createServer(async (request, response) => {
    calls.push(request.url);
    if (!ready) { response.writeHead(503); response.end("{}"); return; }
    if (request.url === "/api/status") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ ready: true })); return; }
    if (request.url === "/threads") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ thread_id: "assistant-test-thread" })); return; }
    if (request.url === "/api/chat") {
      let raw = ""; for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.end(`data: ${JSON.stringify({ event: "assistant/partial", data: { text: "AI thử nghiệm: " + body.message } })}\n\n`); return;
    }
    response.writeHead(404); response.end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { origin: "http://127.0.0.1:" + server.address().port, calls, setReady(value) { ready = value; }, close: () => new Promise(resolve => server.close(resolve)) };
}
