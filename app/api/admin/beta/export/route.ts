import { exportBetaEmails } from "../../../../../lib/beta";
import { getOperator, operatorErrorResponse } from "../../../../../lib/operator";
import { runtimeEnv } from "../../../../../lib/runtime-env";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  if (!runtimeEnv.DB) return Response.json({ error: "D1 is not configured" }, { status: 503 });
  if (!getOperator(request)) return operatorErrorResponse();
  const rows = await exportBetaEmails(runtimeEnv.DB);
  const body = ["email,status,created_at,reviewed_at", ...rows.map((row) => [row.email, row.status, row.created_at, row.reviewed_at ?? ""].map(csvCell).join(","))].join("\n");
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=skillbase-beta-access.csv", "cache-control": "no-store" } });
}
