"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";

type ApprovalStatus = "review" | "approved" | "rejected" | "published";
type VerificationStatus = "unverified" | "legacy" | "static_passed" | "static_warning" | "static_blocked" | "sandbox_passed" | "sandbox_fallback_passed" | "sandbox_failed" | "sandbox_unavailable";
type QueueTab = ApprovalStatus | "all";
type ReviewAction = "approve" | "publish" | "reject" | "review" | "unpublish";

type QueueItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  region: string;
  source: string;
  sourceUrl: string;
  sourceType: string;
  trust: string;
  risk: string;
  discoveredVia: string;
  contentHash: string;
  approvalStatus: ApprovalStatus;
  verificationStatus: VerificationStatus;
  verificationUpdatedAt: string | null;
  verificationSummary: string | null;
  license: string | null;
  lastSeenAt: string;
  approvalUpdatedAt: string | null;
  sourceLinkStatus: string;
  licensePrevious: string | null;
  licenseChangedAt: string | null;
  duplicateOf: string | null;
};

type Counts = Record<ApprovalStatus, number>;
type QualityIssue = {
  id: string;
  skillId: string;
  kind: string;
  severity: string;
  status: string;
  message: string;
  checkedAt: string;
  skillName: string | null;
  skillSource: string | null;
  skillUrl: string | null;
  skillApprovalStatus: ApprovalStatus | null;
  canonicalId: string | null;
  canonicalName: string | null;
  canonicalSource: string | null;
};
type VerificationMetrics = {
  windowDays: number;
  total: number;
  passed: number;
  failed: number;
  queued: number;
  officialCli: number;
  fallback: number;
  static: number;
  averageDurationMs: number | null;
  fallbackRate: number;
  quality?: { open: number; blockers: number; issues: QualityIssue[] };
  usage?: { totalEvents: number; favorites: number; activeUsers: number; topSkills: Array<Record<string, unknown>> };
  alerts?: Array<{ id: string; severity: string; title: string; message: string; created_at: string }>;
};

const tabs: Array<{ key: QueueTab; label: string }> = [
  { key: "review", label: "검토 필요" },
  { key: "approved", label: "승인됨" },
  { key: "rejected", label: "반려됨" },
  { key: "published", label: "공개됨" },
  { key: "all", label: "전체" },
];

const statusLabel: Record<ApprovalStatus, string> = {
  review: "검토 필요",
  approved: "승인됨 · 공개 전",
  rejected: "반려됨",
  published: "공개됨",
};

const actionLabel: Record<ReviewAction, string> = {
  approve: "승인",
  publish: "공개",
  reject: "반려",
  review: "검토로 되돌리기",
  unpublish: "공개 해제",
};

const verificationLabel: Record<VerificationStatus, string> = {
  unverified: "검증 전",
  legacy: "기존 공개",
  static_passed: "정적 검사 통과",
  static_warning: "정적 경고",
  static_blocked: "정적 차단",
  sandbox_passed: "격리 검증 통과",
  sandbox_fallback_passed: "무결성 fallback 통과 · 운영자 확인",
  sandbox_failed: "격리 검증 실패",
  sandbox_unavailable: "격리 실행기 미연결",
};

const publishableVerification = new Set<VerificationStatus>(["legacy", "static_passed", "sandbox_passed", "sandbox_fallback_passed"]);

function formatDate(value: string | null) {
  if (!value) return "아직 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdminQueuePage() {
  const [tab, setTab] = useState<QueueTab>("review");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ review: 0, approved: 0, rejected: 0, published: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [metrics, setMetrics] = useState<VerificationMetrics | null>(null);
  const [toolStatus, setToolStatus] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);

  const loadQueue = useCallback(async (nextTab: QueueTab) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/queue?status=${nextTab}&limit=120`, { cache: "no-store" });
      const payload = await response.json() as { items?: QueueItem[]; counts?: Counts; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "운영자 큐를 불러오지 못했습니다.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      if (payload.counts) setCounts(payload.counts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "운영자 큐를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/metrics?days=30", { cache: "no-store" });
      const payload = await response.json() as { verification?: VerificationMetrics; quality?: VerificationMetrics["quality"]; usage?: VerificationMetrics["usage"]; alerts?: VerificationMetrics["alerts"] };
      if (response.ok && payload.verification) setMetrics({ ...payload.verification, quality: payload.quality, usage: payload.usage, alerts: payload.alerts });
    } catch {
      // Metrics are informative and should not block queue operations.
    }
  }, []);

  const runBackupTest = async () => {
    setToolStatus("백업 복구 가능성을 확인하는 중...");
    try {
      const response = await fetch("/api/admin/backup-test", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; errors?: string[]; counts?: Record<string, number> };
      if (!response.ok || !payload.ok) throw new Error(payload.errors?.join(" | ") ?? "백업 복구 테스트에 실패했습니다.");
      setToolStatus(`백업 복구 테스트 통과 · Skill ${payload.counts?.skills ?? 0}건`);
    } catch (backupError) {
      setToolStatus(backupError instanceof Error ? backupError.message : "백업 복구 테스트에 실패했습니다.");
    }
  };

  const runQualityCheck = async () => {
    setToolStatus("중복·원본 링크·라이선스를 점검하는 중...");
    try {
      const response = await fetch("/api/admin/quality", { method: "POST" });
      const payload = await response.json() as { brokenLinks?: number; duplicates?: number; licenseChanges?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "품질 점검에 실패했습니다.");
      setToolStatus(`품질 점검 완료 · 깨진 링크 ${payload.brokenLinks ?? 0} · 중복 ${payload.duplicates ?? 0} · 라이선스 변경 ${payload.licenseChanges ?? 0}`);
      await loadMetrics();
    } catch (qualityError) {
      setToolStatus(qualityError instanceof Error ? qualityError.message : "품질 점검에 실패했습니다.");
    }
  };

  const testBackupFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setToolStatus("선택한 백업 파일을 검사하는 중...");
    try {
      const response = await fetch("/api/admin/backup-test", { method: "POST", headers: { "content-type": "application/json" }, body: await file.text() });
      const payload = await response.json() as { ok?: boolean; errors?: string[]; warnings?: string[]; counts?: Record<string, number> };
      if (!response.ok || !payload.ok) throw new Error(payload.errors?.join(" | ") ?? "백업 파일을 복구할 수 없습니다.");
      setToolStatus(`백업 파일 검사 통과 · Skill ${payload.counts?.skills ?? 0}건${payload.warnings?.length ? ` · 경고 ${payload.warnings.length}건` : ""}`);
    } catch (backupError) {
      setToolStatus(backupError instanceof Error ? backupError.message : "백업 파일을 검사하지 못했습니다.");
    }
  };

  const resolveAlert = async (alertId: string) => {
    await fetch("/api/admin/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alertId }) });
    await loadMetrics();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadQueue(tab); void loadMetrics(); }, 0);
    const poller = window.setInterval(() => { void loadQueue(tab); void loadMetrics(); }, 10000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poller);
    };
  }, [loadMetrics, loadQueue, tab]);

  const changeStatus = async (skillId: string, action: ReviewAction) => {
    setBusyId(skillId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillId, action }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "승인 상태를 변경하지 못했습니다.");
      setNotice(`“${actionLabel[action]}” 처리했습니다.`);
      await loadQueue(tab);
      await loadMetrics();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "승인 상태를 변경하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const requestVerification = async (skillId: string, mode: "static" | "sandbox") => {
    setBusyId(skillId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillId, mode }),
      });
      const payload = await response.json() as { error?: string; summary?: string };
      if (!response.ok && response.status !== 202) throw new Error(payload.error ?? "검증을 요청하지 못했습니다.");
      setNotice(payload.summary ?? (mode === "static" ? "정적 검사를 완료했습니다." : "격리 검증을 요청했습니다."));
      await loadQueue(tab);
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "검증을 요청하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link prefetch={false} className="brand" href="/" aria-label="skillbase 홈"><span className="brand-mark">s<span>·</span></span><span>skillbase</span></Link>
        <div className="admin-header-actions"><button className="admin-tool-button" onClick={() => void runBackupTest()}>복구 테스트</button><button className="admin-tool-button" onClick={() => backupInputRef.current?.click()}>백업 파일 검사</button><input ref={backupInputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void testBackupFile(event)} /><button className="admin-tool-button" onClick={() => void runQualityCheck()}>품질 점검</button><a className="admin-export" href="/api/admin/export">데이터 백업 ↓</a><Link prefetch={false} className="admin-back" href="/">카탈로그로 돌아가기 ↗</Link></div>
      </header>

      <section className="admin-hero">
        <p className="section-kicker">OPERATOR REVIEW QUEUE</p>
        <h1>공개 전 검토 큐</h1>
        <p>자동 수집된 Skill은 바로 공개하지 않습니다. 원본, 설치 경로, 권한 신호를 확인한 뒤 승인하고 공개하세요.</p>
        <div className="admin-metrics">
          <div><strong>{counts.review}</strong><span>검토 필요</span></div>
          <div><strong>{counts.approved}</strong><span>승인됨 · 공개 전</span></div>
          <div><strong>{counts.published}</strong><span>공개됨</span></div>
          <div><strong>{counts.rejected}</strong><span>반려됨</span></div>
        </div>
        {metrics && <div className="admin-observability" aria-label="최근 30일 검증 지표">
          <span>최근 {metrics.windowDays}일 검증 {metrics.total}건</span>
          <span>공식 CLI {metrics.officialCli}건</span>
          <span>fallback {metrics.fallback}건 ({metrics.fallbackRate}%)</span>
          <span>대기·실패 {metrics.queued + metrics.failed}건</span>
          {metrics.averageDurationMs != null && <span>평균 {Math.round(metrics.averageDurationMs / 1000)}초</span>}
          {metrics.quality && <span>품질 이슈 {metrics.quality.open}건 · 차단 {metrics.quality.blockers}건</span>}
          {metrics.usage && <span>최근 사용 이벤트 {metrics.usage.totalEvents}건 · 즐겨찾기 {metrics.usage.favorites}건</span>}
        </div>}
      </section>

      <section className="admin-content">
        <div className="admin-tabs" role="tablist" aria-label="검토 상태">
          {tabs.map((entry) => (
            <button key={entry.key} className={tab === entry.key ? "selected" : ""} onClick={() => setTab(entry.key)} role="tab" aria-selected={tab === entry.key}>
              {entry.label}<span>{entry.key === "all" ? Object.values(counts).reduce((sum, value) => sum + value, 0) : counts[entry.key]}</span>
            </button>
          ))}
        </div>

        {notice && <p className="admin-notice">✓ {notice}</p>}
        {toolStatus && <p className="admin-notice">{toolStatus}</p>}
        {error && <div className="admin-error"><strong>접근 또는 처리 오류</strong><span>{error}</span></div>}
        {metrics?.alerts && metrics.alerts.length > 0 && <div className="admin-alert-list"><strong>미해결 운영 알림 {metrics.alerts.length}건</strong>{metrics.alerts.map((alert) => <div className="admin-alert" key={alert.id}><span><b>{alert.title}</b> · {alert.message}</span><button onClick={() => void resolveAlert(alert.id)}>확인 처리</button></div>)}</div>}
        {metrics?.quality && metrics.quality.issues.length > 0 && <div className="admin-quality-list">
          <div><strong>품질 검토 필요 {metrics.quality.open}건</strong><span>자동 삭제하지 않습니다. 대표 Skill을 확인한 뒤 중복 공개만 수동 해제하세요.</span></div>
          {metrics.quality.issues.map((issue) => <div className="admin-quality-item" key={issue.id}>
            <div className="admin-quality-copy">
              <div><b>{issue.kind === "duplicate" ? "중복 Skill" : issue.kind === "broken_source" ? "깨진 원본 링크" : "라이선스 변경"}</b><span>{issue.skillName ?? issue.skillId}</span></div>
              <p>{issue.kind === "duplicate" && issue.canonicalName ? `대표: ${issue.canonicalName}${issue.canonicalSource ? ` · ${issue.canonicalSource}` : ""}` : issue.message}</p>
              {issue.skillSource && <small>출처: {issue.skillSource}</small>}
            </div>
            <div className="admin-quality-actions">
              {issue.skillUrl && <a href={issue.skillUrl} target="_blank" rel="noreferrer">원본 보기 ↗</a>}
              {issue.kind === "duplicate" && issue.skillApprovalStatus === "published" && <button className="action-danger" disabled={busyId === issue.skillId} onClick={() => void changeStatus(issue.skillId, "unpublish")}>중복 공개 해제</button>}
            </div>
          </div>)}
        </div>}
        {loading ? (
          <div className="admin-empty">검토 큐를 불러오는 중입니다.</div>
        ) : items.length === 0 ? (
          <div className="admin-empty"><strong>{tab === "review" ? "새로 검토할 Skill이 없습니다." : "이 상태의 Skill이 없습니다."}</strong><span>다음 자동 수집에서 새 항목이나 내용 변경 항목이 들어오면 여기에 표시됩니다.</span></div>
        ) : (
          <div className="review-list">
            {items.map((skill) => (
              <article className="review-card" key={skill.id}>
                <div className="review-card-heading">
                  <div className="review-monogram">{skill.name.slice(0, 3).toUpperCase()}</div>
                  <div className="review-title"><div><h2>{skill.name}</h2><span className={`approval-pill approval-${skill.approvalStatus}`}>{statusLabel[skill.approvalStatus]}</span><span className={`verification-pill verification-${skill.verificationStatus}`}>{verificationLabel[skill.verificationStatus]}</span></div><p>{skill.category} · {skill.region} · {skill.sourceType}</p></div>
                  <a className="review-source" href={skill.sourceUrl} target="_blank" rel="noreferrer">원본 보기 ↗</a>
                </div>
                <p className="review-description">{skill.description}</p>
                <div className="review-meta"><span>출처: {skill.source}</span><span>발견 경로: {skill.discoveredVia}</span><span>위험도: {skill.risk}</span><span>라이선스: {skill.license ?? "미상"}{skill.licensePrevious && " · 변경 감지"}</span><span>원본 링크: {skill.sourceLinkStatus === "ok" ? "정상" : skill.sourceLinkStatus === "broken" ? "깨짐" : "미확인"}</span>{skill.duplicateOf && <span>중복 대표: {skill.duplicateOf.slice(0, 10)}</span>}<span>해시: {skill.contentHash.slice(0, 10)}</span><span>최근 확인: {formatDate(skill.lastSeenAt)}</span><span>검증: {formatDate(skill.verificationUpdatedAt)}</span></div>
                {skill.verificationSummary && <p className="verification-summary">{skill.verificationSummary}</p>}
                <div className="review-actions">
                  <button className="action-secondary" disabled={busyId === skill.id} onClick={() => void requestVerification(skill.id, "static")}>{skill.verificationStatus === "unverified" ? "정적 검사" : "정적 재검사"}</button>
                  {skill.verificationStatus !== "static_blocked" && skill.verificationStatus !== "sandbox_passed" && skill.verificationStatus !== "sandbox_fallback_passed" && <button className="action-secondary" disabled={busyId === skill.id} onClick={() => void requestVerification(skill.id, "sandbox")}>격리 검증 요청</button>}
                  {skill.approvalStatus === "review" && <><button className="action-primary" disabled={busyId === skill.id} onClick={() => void changeStatus(skill.id, "approve")}>승인 → 공개 전</button><button className="action-danger" disabled={busyId === skill.id} onClick={() => void changeStatus(skill.id, "reject")}>반려</button></>}
                  {skill.approvalStatus === "approved" && <>{publishableVerification.has(skill.verificationStatus) ? <button className="action-primary" disabled={busyId === skill.id} onClick={() => void changeStatus(skill.id, "publish")}>공개하기</button> : <button className="action-disabled" disabled>검증 후 공개</button>}<button className="action-danger" disabled={busyId === skill.id} onClick={() => void changeStatus(skill.id, "reject")}>반려</button></>}
                  {skill.approvalStatus === "rejected" && <button className="action-secondary" disabled={busyId === skill.id} onClick={() => void changeStatus(skill.id, "review")}>검토로 되돌리기</button>}
                  {skill.approvalStatus === "published" && <><button className="action-secondary" disabled={busyId === skill.id} onClick={() => void changeStatus(skill.id, "review")}>재검토 요청</button><button className="action-danger" disabled={busyId === skill.id} onClick={() => void changeStatus(skill.id, "unpublish")}>공개 해제</button></>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
