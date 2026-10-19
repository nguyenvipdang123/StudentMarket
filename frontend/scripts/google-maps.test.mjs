import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as maps from "../lib/google-maps.ts";
import { googleMapsEmbedUrl, googleMapsLinks, mapQuery, meetingLocation } from "../lib/google-maps.ts";

test("blank addresses do not produce links or an invalid Google request", () => {
  assert.equal(googleMapsLinks("  \n "), null);
  assert.equal(googleMapsEmbedUrl("", "test-key"), null);
  assert.equal(googleMapsEmbedUrl("UEH", ""), null);
  assert.equal(mapQuery("", "UEH"), "");
});

test("Vietnamese addresses and plus codes cannot inject URL parameters or redirect hosts", () => {
  const address = "Cổng A & destination=https://evil.invalid/ # 7P28+3G, TP.HCM";
  const links = googleMapsLinks(address);
  for (const value of Object.values(links)) assert.equal(new URL(value).hostname, "www.google.com");
  assert.equal(new URL(links.search).searchParams.get("query"), address);
  assert.equal(new URL(links.directions).searchParams.get("destination"), address);
  assert.equal(new URL(links.directions).searchParams.has("origin"), false);
  const embed = new URL(googleMapsEmbedUrl(address, "test-key&language=en"));
  assert.equal(embed.searchParams.get("q"), address);
  assert.equal(embed.searchParams.get("key"), "test-key&language=en");
  assert.equal(embed.searchParams.get("language"), "vi");
});

test("school context is preserved without repeating an existing address", () => {
  assert.equal(mapQuery(" ĐH Kinh tế TP.HCM ", "ĐH Kinh tế TP.HCM"), "ĐH Kinh tế TP.HCM");
  assert.equal(mapQuery("Sân thư viện", "ĐH Kinh tế TP.HCM"), "Sân thư viện, ĐH Kinh tế TP.HCM");
  assert.equal(mapQuery("Nhà A, 7P28+3G"), "Nhà A, 7P28+3G");
});

test("meeting links accept existing message format without interpreting arbitrary text as a meeting", () => {
  assert.equal(meetingLocation("📅 Đề xuất hẹn gặp\r\nThời gian: 12:00\r\nĐịa điểm: Cổng A & B"), "Cổng A & B");
  assert.equal(meetingLocation("Xin chào\nĐịa điểm: X"), "");
  assert.equal(meetingLocation("📅 Đề xuất hẹn gặp\nThời gian: 12:00"), "");
  assert.equal(meetingLocation("📅 Đề xuất hẹn gặp\nĐịa điểm: " + "x".repeat(201)), "");
});

test("map UI avoids invalid iframe without a key and supports restricted-key embedding and explicit previews", () => {
  const require = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL("../components/LocationMap.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  runInNewContext(compiled, {
    module: mod, exports: mod.exports, process,
    require: name => name === "@/lib/google-maps" ? maps : name === "./FigmaIcon" ? (() => null) : name.endsWith(".module.css") ? {} : require(name),
  });
  const Component = mod.exports.default;
  const previous = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
  try {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
    const fallback = renderToStaticMarkup(createElement(Component, { location: "Sân thư viện", school: "UEH" }));
    assert.ok(fallback.includes("Chỉ đường"));
    assert.ok(!fallback.includes("<iframe"));
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY = "test-key";
    const embedded = renderToStaticMarkup(createElement(Component, { location: "Sân thư viện", school: "UEH" }));
    assert.ok(embedded.includes("<iframe"));
    assert.match(embedded, /referrerPolicy="strict-origin-when-cross-origin"/i);
    assert.match(embedded, /loading="lazy"/);
    const src = embedded.match(/src="([^"]+)"/)[1].replaceAll("&amp;", "&");
    assert.equal(new URL(src).searchParams.get("q"), "Sân thư viện, UEH");
    const preview = renderToStaticMarkup(createElement(Component, { location: "Sân thư viện", preview: true }));
    assert.ok(!preview.includes("<iframe"));
    assert.ok(preview.includes("Xem bản đồ"));
    assert.match(preview, /<button[^>]*type="button"/);
    assert.equal(renderToStaticMarkup(createElement(Component, { location: "" })), "");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
    else process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY = previous;
  }
});
