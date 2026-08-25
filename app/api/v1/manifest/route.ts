export const dynamic = "force-static";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    name: "skillbase",
    version: "1",
    description: "검증 상태와 원본 출처를 포함한 AI Skills 카탈로그",
    baseUrl: origin,
    endpoints: {
      skills: `${origin}/api/v1/skills`,
      health: `${origin}/api/health`,
    },
    filters: ["q", "category", "region", "platform", "verification", "sort", "limit"],
    rateLimit: { requests: 120, window: "1h", header: "X-RateLimit-Remaining" },
    license: `${origin}/licenses`,
  }, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
}
