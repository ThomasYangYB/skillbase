import { recordOpsAlerts, type AlertEnv } from "./alerts";
import { getSummaryMetrics, getSyncStatus } from "./sync";

type ObservabilityEnv = AlertEnv & { AI?: unknown; OPENAI_API_KEY?: string };

export type OperationalHealth = {
  status: "ok" | "warning" | "critical" | "unconfigured";
  staleSkills: number;
  summaryPending: number;
  summaryFailures: number;
  summaryProviderConfigured: boolean;
  latestSync: string;
  alertsCreated: number;
  checkedAt: string;
};

/**
 * Runs after scheduled ingestion so a successful Worker invocation cannot
 * hide a degraded catalog. Alerts are fingerprinted and cooled down in
 * `recordOpsAlerts`, so this remains safe to call every cron cycle.
 */
export async function monitorOperationalHealth(env: ObservabilityEnv): Promise<OperationalHealth> {
  const checkedAt = new Date().toISOString();
  if (!env.DB) return { status: "unconfigured", staleSkills: 0, summaryPending: 0, summaryFailures: 0, summaryProviderConfigured: Boolean(env.AI || env.OPENAI_API_KEY), latestSync: "unconfigured", alertsCreated: 0, checkedAt };

  const [sync, summaries] = await Promise.all([getSyncStatus(env.DB), getSummaryMetrics(env.DB)]);
  const latestSync = String(sync.latestRun?.status ?? "unknown");
  const staleSkills = sync.staleSkills;
  const summaryPending = summaries.pending;
  const summaryFailures = summaries.failed;
  const summaryProviderConfigured = Boolean(env.AI || env.OPENAI_API_KEY);
  const alerts = [];

  if (latestSync === "failed" || latestSync === "completed_with_errors") {
    alerts.push({
      kind: "operational_health" as const,
      severity: "critical" as const,
      title: "최근 Skill 수집 상태 점검 필요",
      message: `최근 수집 작업 상태가 ${latestSync}입니다. 수집 로그와 원본 호스트 응답을 확인하세요.`,
      fingerprint: `health:sync:${latestSync}`,
    });
  }
  if (staleSkills > 0) {
    alerts.push({
      kind: "operational_health" as const,
      severity: "warning" as const,
      title: "오래된 Skill 발견",
      message: `${staleSkills}개의 Skill이 최근 수집에서 확인되지 않았습니다. 원본 변경 또는 수집 실패 여부를 확인하세요.`,
      fingerprint: `health:stale:${staleSkills}`,
    });
  }
  if (summaryFailures > 0) {
    alerts.push({
      kind: "operational_health" as const,
      severity: "warning" as const,
      title: "한국어 요약 생성 실패",
      message: `${summaryFailures}개의 Skill 요약 생성이 실패했습니다. AI 바인딩과 요약 재시도를 확인하세요.`,
      fingerprint: `health:summary-failed:${summaryFailures}`,
    });
  }
  if (!summaryProviderConfigured && summaryPending > 0) {
    alerts.push({
      kind: "operational_health" as const,
      severity: "warning" as const,
      title: "AI 한국어 요약 제공자 미연결",
      message: `${summaryPending}개의 Skill 요약이 대기 중입니다. Workers AI 바인딩 또는 OPENAI_API_KEY를 연결하세요.`,
      fingerprint: "health:summary-provider-missing",
    });
  }

  const alertsCreated = await recordOpsAlerts(env, alerts);
  const status = latestSync === "failed" || latestSync === "completed_with_errors" ? "critical" : alerts.length > 0 ? "warning" : "ok";
  return { status, staleSkills, summaryPending, summaryFailures, summaryProviderConfigured, latestSync, alertsCreated, checkedAt };
}
