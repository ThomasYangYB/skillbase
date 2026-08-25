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

test("protects mobile layouts from horizontal overflow", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 768px\)/);
  assert.match(css, /\.explore-layout \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.skill-card, \.skill-card-top, \.skill-card-title, \.title-line \{ min-width: 0; \}/);
  assert.match(css, /\.detail-code code \{ min-width: 0; text-overflow: ellipsis/);
  assert.match(css, /\.prompt-actions \{ flex-direction: column; \}/);
});

test("keeps operations, public API, and user submission safeguards configured", async () => {
  const [sync, summaryRoute, submissionRoute, adminSubmissionRoute, backup, feedback, publicApi, detail, migration] = await Promise.all([
    readFile(new URL("../lib/sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/summaries/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/backup.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/skills/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/skills/[...id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0009_skill_submissions.sql", import.meta.url), "utf8"),
  ]);
  assert.match(sync, /getSummaryMetrics/);
  assert.match(sync, /summary_review_status/);
  assert.match(summaryRoute, /retrySkillSummaries/);
  assert.match(summaryRoute, /reviewSkillSummary/);
  assert.match(submissionRoute, /하루에 3건까지/);
  assert.match(adminSubmissionRoute, /submission_approve/);
  assert.match(backup, /usageEvents/);
  assert.match(feedback, /application\/json/);
  assert.match(feedback, /recordOpsAlerts/);
  assert.match(publicApi, /access-control-allow-origin/);
  assert.match(detail, /openGraph/);
  assert.match(migration, /skill_submissions/);
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
  assert.match(feedbackRoute, /datetime\('now', '-1 day'\)/);
  assert.match(qualityLib, /broken_source/);
  assert.match(qualityLib, /license_changed/);
  assert.match(usageLib, /skill_usage_events/);
  assert.match(maintenanceWorkflow, /npm audit/);
  assert.match(maintenanceWorkflow, /npm view skills version/);
  assert.match(dependabot, /sandbox-adapter/);
  assert.match(operationalMigration, /ops_alerts/);
});

test("keeps durable abuse protection and restore rehearsal configured", async () => {
  const [rateLimit, publicApi, feedback, submissions, backup, backupRoute, schema, migration, operator, docs, restoreScript, packageJson, workspaceLib, workspaceRoute, workspacePage, workspaceMigration, detail, fixture, workflow] = await Promise.all([
    readFile(new URL("../lib/rate-limit.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/skills/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/backup.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/backup-test/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0010_request_rate_limits.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/operator.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/operations.md", import.meta.url), "utf8"),
    readFile(new URL("../scripts/restore-rehearsal.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/workspaces.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/workspaces/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/workspaces/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0011_private_workspaces.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/skills/[...id]/SkillDetailClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../tests/fixtures/backup-minimal.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/maintenance.yml", import.meta.url), "utf8"),
  ]);
  assert.match(rateLimit, /request_rate_limits/);
  assert.match(rateLimit, /x-ratelimit-remaining/);
  assert.match(publicApi, /enforceD1RateLimit/);
  assert.match(feedback, /enforceD1RateLimit/);
  assert.match(submissions, /enforceD1RateLimit/);
  assert.match(backup, /buildRestorePlan/);
  assert.match(backup, /submissions/);
  assert.match(backupRoute, /mode: "dry-run"/);
  assert.match(schema, /requestRateLimits/);
  assert.match(migration, /request_rate_limits/);
  assert.match(operator, /sec-fetch-site/);
  assert.match(docs, /staging D1/);
  assert.match(restoreScript, /DatabaseSync/);
  assert.match(restoreScript, /isolated-sqlite-restore/);
  assert.match(packageJson, /backup:restore-test/);
  assert.match(workspaceLib, /getWorkspaceAccess/);
  assert.match(workspaceLib, /invite_token_hash/);
  assert.match(workspaceRoute, /getRequestActor/);
  assert.match(workspacePage, /비공개 공간/);
  assert.match(workspaceMigration, /skill_workspace_items/);
  assert.match(detail, /비공개 공간에 저장/);
  assert.match(fixture, /workspaceItems/);
  assert.match(fixture, /betaAccessRequests/);
  assert.match(workflow, /backup:restore-test/);
});

test("keeps launch trust pages and production health checks configured", async () => {
  const [health, manifest, betaRoute, adminBeta, betaPage, betaMigration, schema, backup, restore, privacy, terms, licenses, healthScript, retention, worker, packageJson, maintenance, page] = await Promise.all([
    readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/manifest/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/beta/request/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/beta/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/beta/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0012_beta_access_requests.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/backup.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/restore-rehearsal.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/licenses/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/health-check.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/retention.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/maintenance.yml", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(health, /SELECT 1 AS ok/);
  assert.match(health, /pendingReviews/);
  assert.match(manifest, /api\/v1\/skills/);
  assert.match(betaRoute, /enforceD1RateLimit/);
  assert.match(adminBeta, /reviewBetaAccessRequest/);
  assert.match(betaPage, /베타 신청하기/);
  assert.match(betaMigration, /beta_access_requests/);
  assert.match(schema, /betaAccessRequests/);
  assert.match(backup, /betaAccessRequests/);
  assert.match(restore, /0012_beta_access_requests/);
  assert.match(privacy, /개인정보처리방침/);
  assert.match(terms, /이용약관/);
  assert.match(licenses, /원본·라이선스/);
  assert.match(healthScript, /SKILLBASE_SITE_URL/);
  assert.match(retention, /180/);
  assert.match(worker, /pruneUsageEvents/);
  assert.match(packageJson, /health:check/);
  assert.match(maintenance, /production-health/);
  assert.match(page, /href="\/privacy"/);
  assert.match(page, /href="\/licenses"/);
  assert.match(page, /initialQueryParam/);
  assert.match(page, /history\.replaceState/);
});

test("keeps scheduled health monitoring and API discovery configured", async () => {
  const [observability, alerts, worker, health, manifest, openapi, publicApi] = await Promise.all([
    readFile(new URL("../lib/observability.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/alerts.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/manifest/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/openapi.json/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/skills/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(observability, /monitorOperationalHealth/);
  assert.match(observability, /completed_with_errors/);
  assert.match(observability, /summaryFailures/);
  assert.match(alerts, /operational_health/);
  assert.match(worker, /monitorOperationalHealth/);
  assert.match(health, /completed_with_errors/);
  assert.match(manifest, /api\/v1\/openapi\.json/);
  assert.match(openapi, /openapi: "3\.1\.0"/);
  assert.match(openapi, /listSkills/);
  assert.match(publicApi, /access-control-allow-headers/);
});

test("keeps the automatic Korean summary provider path explicit", async () => {
  const [sync, runtimeEnv, worker, metricsRoute, adminPage, detail, page, docs, checklist] = await Promise.all([
    readFile(new URL("../lib/sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/runtime-env.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/metrics/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skills/[...id]/SkillDetailClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/operations.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/launch-checklist.md", import.meta.url), "utf8"),
  ]);
  assert.match(sync, /OPENAI_API_KEY/);
  assert.match(sync, /chat\/completions/);
  assert.match(sync, /summary:provider-missing/);
  assert.match(runtimeEnv, /OPENAI_MODEL/);
  assert.match(worker, /OPENAI_API_BASE_URL/);
  assert.match(metricsRoute, /aiConfigured/);
  assert.match(adminPage, /AI 제공자 미연결/);
  assert.match(detail, /자동 한국어 요약 생성 대기 중입니다/);
  assert.match(page, /summaryStatus/);
  assert.match(docs, /OPENAI_API_KEY/);
  assert.match(checklist, /AI 제공자가 연결됨/);
  assert.match(sync, /OPENAI_API_BASE_URL/);
  assert.match(readFile ? await readFile(new URL("../app/api/admin/summaries/route.ts", import.meta.url), "utf8") : "", /processPendingSkillSummaries/);
});
