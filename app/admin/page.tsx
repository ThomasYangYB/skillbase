"use client";

import { useCallback, useEffect, useState } from "react";
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
  lastSeenAt: string;
  approvalUpdatedAt: string | null;
};

type Counts = Record<ApprovalStatus, number>;

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

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadQueue(tab); }, 0);
    const poller = window.setInterval(() => { void loadQueue(tab); }, 10000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poller);
    };
  }, [loadQueue, tab]);

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
        <Link className="brand" href="/" aria-label="skillbase 홈"><span className="brand-mark">s<span>·</span></span><span>skillbase</span></Link>
        <Link className="admin-back" href="/">카탈로그로 돌아가기 ↗</Link>
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
        {error && <div className="admin-error"><strong>접근 또는 처리 오류</strong><span>{error}</span></div>}
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
                <div className="review-meta"><span>출처: {skill.source}</span><span>발견 경로: {skill.discoveredVia}</span><span>위험도: {skill.risk}</span><span>해시: {skill.contentHash.slice(0, 10)}</span><span>최근 확인: {formatDate(skill.lastSeenAt)}</span><span>검증: {formatDate(skill.verificationUpdatedAt)}</span></div>
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
