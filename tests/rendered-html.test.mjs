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
  assert.match(html, /한국어 요약/);
  assert.match(html, /운영자 큐/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("keeps the installation and prompt workflow in the product source", async () => {
  const [page, layout, detail] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skills/[...id]/SkillDetailClient.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /navigator\.clipboard/);
  assert.match(page, /설치 후 확인 표시/);
  assert.match(page, /복사 후 앱 열기/);
  assert.match(page, /원본 확인/);
  assert.match(page, /sourceUrl/);
  assert.match(layout, /title: "skillbase — 실제 AI Skills 카탈로그"/);
  assert.match(layout, /<html lang="ko">/);
  assert.match(detail, /<Link prefetch=\{false\} className="brand" href="\/" aria-label="skillbase 홈" onClick=/);
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

test("queues AI Korean summaries for new and changed Skills", async () => {
  const [sync, worker, route, migration, vite] = await Promise.all([
    readFile(new URL("../lib/sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0007_skill_summaries.sql", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(sync, /summary_status IN \('pending', 'failed'\)/);
  assert.match(sync, /SUMMARY_MODEL/);
  assert.match(sync, /summary_ko/);
  assert.match(worker, /processPendingSkillSummaries/);
  assert.match(route, /processPendingSkillSummaries/);
  assert.match(migration, /summary_ko/);
  assert.match(vite, /ai: \{ binding: "AI" \}/);
});

test("keeps the operator approval queue and publication gate configured", async () => {
  const [schema, sync, route, operator, adminPage, migration, verification, callback, verificationRoute, verificationMigration, metricsRoute, exportRoute, observabilityMigration, alertsRoute, backupRoute, qualityRoute, usageRoute, favoritesRoute, feedbackRoute, qualityLib, usageLib, maintenanceWorkflow, dependabot, operationalMigration] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/queue/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/operator.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_supreme_zodiak.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/verification.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/verification/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/verification/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_supreme_brood.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/metrics/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_verification_observability.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/alerts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/backup-test/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/quality/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/usage/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/favorites/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/quality.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/usage.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/maintenance.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/dependabot.yml", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0006_operational_quality_usage.sql", import.meta.url), "utf8"),
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
  assert.match(sync, /정적 검사, 공식 격리 검증 또는 무결성 fallback 검증/);
  assert.match(sync, /sandbox_fallback_passed/);
  assert.match(verification, /runStaticVerification/);
  assert.match(verification, /SKILLBASE_SANDBOX_URL/);
  assert.match(verification, /integrity_fallback/);
  assert.match(callback, /sourceHash/);
  assert.match(callback, /verificationMethod/);
  assert.match(verificationRoute, /jobStatus === "queued"/);
  assert.match(verificationMigration, /verification_status` = 'legacy'/);
  assert.match(schema, /verificationMethod/);
  assert.match(verification, /getVerificationMetrics/);
  assert.match(metricsRoute, /getVerificationMetrics/);
  assert.match(exportRoute, /content-disposition/);
  assert.match(observabilityMigration, /verification_method/);
  assert.match(adminPage, /데이터 백업/);
  assert.match(alertsRoute, /resolveOpsAlert/);
  assert.match(backupRoute, /validateBackupSnapshot/);
  assert.match(qualityRoute, /runQualityChecks/);
  assert.match(usageRoute, /getUsageMetrics/);
  assert.match(favoritesRoute, /setFavorite/);
  assert.match(feedbackRoute, /datetime\('now', '-1 hour'\)/);
  assert.match(qualityLib, /broken_source/);
  assert.match(qualityLib, /license_changed/);
  assert.match(usageLib, /skill_usage_events/);
  assert.match(maintenanceWorkflow, /npm audit/);
  assert.match(maintenanceWorkflow, /npm view skills version/);
  assert.match(dependabot, /sandbox-adapter/);
  assert.match(operationalMigration, /ops_alerts/);
});
