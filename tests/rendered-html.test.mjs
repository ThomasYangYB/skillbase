import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the skillbase catalog", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>skillbase — 검증된 AI Skills<\/title>/i);
  assert.match(html, /AI Skill을 찾고/);
  assert.match(html, /검증된 Skills/);
  assert.match(html, /개발·IT/);
  assert.match(html, /권한 위험도/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("keeps the installation and prompt workflow in the product source", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /navigator\.clipboard/);
  assert.match(page, /설치 후 검증 실행/);
  assert.match(page, /복사 후 앱 열기/);
  assert.match(page, /호환성 확인됨/);
  assert.match(layout, /title: "skillbase — 검증된 AI Skills"/);
  assert.match(layout, /<html lang="ko">/);
});
