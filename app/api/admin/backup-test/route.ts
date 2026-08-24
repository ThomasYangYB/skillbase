import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { createBackupSnapshot, validateBackupSnapshot } from "../../../../lib/backup";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  try {
    const snapshot = await createBackupSnapshot(runtimeEnv.DB);
    const validation = await validateBackupSnapshot(snapshot);
    return Response.json({ mode: "dry-run", ...validation, testedAt: new Date().toISOString() }, { status: validation.ok ? 200 : 500, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ mode: "dry-run", ok: false, errors: [error instanceof Error ? error.message : "백업 복구 테스트에 실패했습니다."] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  const raw = await request.text();
  if (raw.length > 20_000_000) return Response.json({ error: "백업 파일이 너무 큽니다." }, { status: 413 });
  try {
    const backup = JSON.parse(raw) as unknown;
    const validation = await validateBackupSnapshot(backup);
    return Response.json({ mode: "dry-run", ...validation, testedAt: new Date().toISOString() }, { status: validation.ok ? 200 : 422 });
  } catch {
    return Response.json({ mode: "dry-run", ok: false, errors: ["유효한 백업 JSON이 아닙니다."] }, { status: 422 });
  }
}
