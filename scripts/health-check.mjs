const baseUrl = (process.env.SKILLBASE_SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
const bearer = process.env.SKILLBASE_SITE_BEARER_TOKEN || process.env.SITE_BEARER_TOKEN || "";

if (!baseUrl) {
  console.error("SKILLBASE_SITE_URL 또는 SITE_URL이 필요합니다.");
  process.exit(2);
}

const headers = bearer ? { "OAI-Sites-Authorization": `Bearer ${bearer}` } : {};
const results = [];
const payloads = new Map();
const checks = ["/api/health", "/api/v1/manifest", "/api/v1/openapi.json", "/api/v1/skills?limit=1"];
for (const path of checks) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const body = await response.text();
  results.push({ path, status: response.status, ok: response.ok, rateLimit: response.headers.get("x-ratelimit-limit") });
  if (!response.ok) {
    console.error(JSON.stringify({ ok: false, results, failed: path, body: body.slice(0, 300) }));
    process.exit(1);
  }
  try {
    payloads.set(path, JSON.parse(body));
  } catch {
    console.error(JSON.stringify({ ok: false, results, failed: path, error: "JSON 응답이 아닙니다." }));
    process.exit(1);
  }
}

const expectedOrigin = new URL(baseUrl).origin;
const manifest = payloads.get("/api/v1/manifest");
const openapi = payloads.get("/api/v1/openapi.json");
const health = payloads.get("/api/health");
const summaryProvider = health?.summaries?.provider ?? "unknown";
if (process.env.SKILLBASE_REQUIRE_SUMMARY_PROVIDER === "true" && !["workers_ai", "openai_compatible"].includes(summaryProvider)) {
  console.error(JSON.stringify({ ok: false, results, failed: "summary-provider", provider: summaryProvider }));
  process.exit(1);
}
const originValues = [manifest?.baseUrl, manifest?.detailEndpoint, openapi?.servers?.[0]?.url];
const originChecks = originValues
  .filter((value) => typeof value === "string")
  .map((value) => new URL(value.replace("{skillId}", "health-check"), baseUrl).origin);
if (originChecks.length !== originValues.length || originChecks.some((origin) => origin !== expectedOrigin)) {
  console.error(JSON.stringify({ ok: false, results, failed: "origin-contract", expectedOrigin, originChecks }));
  process.exit(1);
}

const data = Array.isArray(payloads.get("/api/v1/skills?limit=1")?.data) ? payloads.get("/api/v1/skills?limit=1").data : [];
const detailTemplate = typeof manifest?.detailEndpoint === "string" ? manifest.detailEndpoint : "";
if (data[0]?.id && detailTemplate) {
  const detailUrl = detailTemplate.replace("{skillId}", encodeURIComponent(String(data[0].id)));
  const detailResponse = await fetch(detailUrl, { headers });
  if (!detailResponse.ok) {
    console.error(JSON.stringify({ ok: false, results, failed: "detail-contract", status: detailResponse.status }));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  results,
  originContract: "ok",
  detailContract: data[0]?.id ? "ok" : "skipped_empty_catalog",
  summaryProvider,
  summaryWarning: Array.isArray(health?.warnings) && health.warnings.includes("summary_provider_unconfigured"),
}));
