const baseUrl = (process.env.SKILLBASE_SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
const bearer = process.env.SKILLBASE_SITE_BEARER_TOKEN || process.env.SITE_BEARER_TOKEN || "";

if (!baseUrl) {
  console.error("SKILLBASE_SITE_URL 또는 SITE_URL이 필요합니다.");
  process.exit(2);
}

const headers = bearer ? { "OAI-Sites-Authorization": `Bearer ${bearer}` } : {};
const checks = ["/api/health", "/api/v1/manifest", "/api/v1/skills?limit=1"];
const results = [];
for (const path of checks) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const body = await response.text();
  results.push({ path, status: response.status, ok: response.ok, rateLimit: response.headers.get("x-ratelimit-limit") });
  if (!response.ok) {
    console.error(JSON.stringify({ ok: false, results, failed: path, body: body.slice(0, 300) }));
    process.exit(1);
  }
}
console.log(JSON.stringify({ ok: true, baseUrl, results }));
