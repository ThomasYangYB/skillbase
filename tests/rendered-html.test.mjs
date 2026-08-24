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
  assert.match(html, /<title>skillbase — 실제 AI Skills 카탈로그<\/title>/i);
  assert.match(html, /AI Skill을 찾고/);
  assert.match(html, /수집된 Skills/);
  assert.match(html, /매일 자동 수집 예약/);
  assert.match(html, /개발·IT/);
  assert.match(html, /humanizer/);
  assert.match(html, /frontend-design/);
  assert.match(html, /권한 위험도/);
  assert.match(html, /운영자 큐/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("keeps the installation and prompt workflow in the product source", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /navigator\.clipboard/);
  assert.match(page, /설치 후 확인 표시/);
  assert.match(page, /복사 후 앱 열기/);
  assert.match(page, /원본 확인/);
  assert.match(page, /sourceUrl/);
  assert.match(layout, /title: "skillbase — 실제 AI Skills 카탈로그"/);
  assert.match(layout, /<html lang="ko">/);
});

test("keeps the scheduled Agent Skills collection pipeline configured", async () => {
  const [sync, worker, vite, hosting] = await Promise.all([
    readFile(new URL("../lib/sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(sync, /SKILL\.md/i);
  assert.match(sync, /skills-sh-leaderboard/);
  assert.match(sync, /directory-claude-korea/);
  assert.match(sync, /contentHash/);
  assert.match(worker, /async scheduled/);
  assert.match(vite, /crons: \["17 3 \* \* \*"\]/);
  assert.match(hosting, /"d1": "DB"/);
});

test("keeps the operator approval queue and publication gate configured", async () => {
  const [schema, sync, route, operator, adminPage, migration, verification, callback, verificationMigration] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/queue/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/operator.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_supreme_zodiak.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/verification.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/verification/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_supreme_brood.sql", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /approvalStatus/);
  assert.match(schema, /skillReviewEvents/);
  assert.match(sync, /approval_status = 'published'/);
  assert.match(sync, /CASE WHEN skills\.content_hash <> excluded\.content_hash THEN 'review'/);
  assert.match(operator, /oai-authenticated-user-id/);
  assert.match(route, /changeSkillApproval/);
  assert.match(adminPage, /검토 필요/);
  assert.match(adminPage, /공개하기/);
  assert.match(migration, /UPDATE `skills` SET `approval_status` = 'published'/);
  assert.match(schema, /skillVerificationJobs/);
  assert.match(sync, /정적 검사 통과 또는 격리 검증 통과/);
  assert.match(verification, /runStaticVerification/);
  assert.match(verification, /SKILLBASE_SANDBOX_URL/);
  assert.match(callback, /sourceHash/);
  assert.match(verificationMigration, /verification_status` = 'legacy'/);
});
