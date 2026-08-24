import { getOperator, operatorErrorResponse } from "../../../../lib/operator";
import { createBackupSnapshot } from "../../../../lib/backup";
import { runtimeEnv } from "../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  try {
    const snapshot = await createBackupSnapshot(runtimeEnv.DB);
    const filename = `skillbase-export-${new Date().toISOString().slice(0, 10)}.json`;
    return Response.json(snapshot, {
      headers: { "cache-control": "no-store", "content-disposition": `attachment; filename="${filename}"` },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "백업 파일을 만들지 못했습니다." }, { status: 500 });
  }
}
