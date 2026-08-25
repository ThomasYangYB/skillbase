export const dynamic = "force-static";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "Skillbase Skills API",
      version: "1.0.0",
      description: "검증 상태와 원본 출처를 포함한 공개 AI Skills 카탈로그 API",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/v1/skills": {
        get: {
          summary: "공개 Skill 검색",
          operationId: "listSkills",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "region", in: "query", schema: { type: "string", enum: ["국내", "해외"] } },
            { name: "platform", in: "query", schema: { type: "string" } },
            { name: "verification", in: "query", schema: { type: "string" } },
            { name: "sort", in: "query", schema: { type: "string", enum: ["recommended", "latest", "popular", "name"] } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          ],
          responses: {
            "200": { description: "공개 승인된 Skill 목록", content: { "application/json": { schema: { $ref: "#/components/schemas/SkillListResponse" } } } },
            "429": { description: "시간당 호출 한도 초과" },
            "503": { description: "D1 데이터베이스 미설정 또는 일시 오류" },
          },
        },
      },
      "/api/health": {
        get: {
          summary: "서비스 상태 확인",
          operationId: "getHealth",
          responses: { "200": { description: "서비스 정상" }, "503": { description: "서비스 점검 필요" } },
        },
      },
    },
    components: {
      schemas: {
        SkillListResponse: {
          type: "object",
          required: ["data", "meta"],
          properties: {
            data: { type: "array", items: { type: "object", additionalProperties: true } },
            meta: { type: "object", additionalProperties: true },
          },
        },
      },
    },
  }, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
}
