"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SkillDetail = {
  id: string; name: string; category: string; description: string; tags: string[]; compatibility: string[];
  summaryKo?: string | null;
  risk: "낮음" | "주의"; region: "국내" | "해외"; source: string; sourceUrl: string; sourceType: "공식" | "커뮤니티" | "디렉터리";
  trust: "원본 확인" | "검토 필요"; prompt: string; install: string; appUrl: string; license?: string | null;
  verificationStatus?: string; verificationSummary?: string | null; verificationUpdatedAt?: string | null;
  sourceLinkStatus?: string; sourceLinkCheckedAt?: string | null; sourceLinkError?: string | null;
  licensePrevious?: string | null; licenseChangedAt?: string | null; updatedAt?: string;
};

function verificationLabel(status?: string) {
  if (status === "sandbox_passed") return "격리 실행 검증 통과";
  if (status === "sandbox_fallback_passed") return "무결성 fallback 검증 통과";
  if (status === "static_passed") return "정적 검사 통과";
  if (status === "legacy") return "기존 원본 확인";
  return "검증 결과 확인 필요";
}

export default function SkillDetailClient({ skillId }: { skillId: string }) {
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [prompt, setPrompt] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    fetch(`/api/skills/detail?id=${encodeURIComponent(skillId)}`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { skill?: SkillDetail; error?: string };
      if (!response.ok || !payload.skill) throw new Error(payload.error ?? "공개된 Skill을 찾을 수 없습니다.");
      setSkill(payload.skill);
      setPrompt(payload.skill.prompt);
    }).catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Skill을 불러오지 못했습니다."));
  }, [skillId]);

  useEffect(() => {
    if (!skill) return;
    fetch("/api/favorites", { cache: "no-store" }).then((response) => response.json()).then((payload: { ids?: string[] }) => setFavorite(payload.ids?.includes(skill.id) ?? false)).catch(() => undefined);
  }, [skill]);

  if (!skill) return <main className="detail-shell"><header className="detail-topbar"><Link prefetch={false} className="brand" href="/" aria-label="skillbase 홈" onClick={(event) => { event.preventDefault(); window.location.assign("/"); }}><span className="brand-mark">s<span>·</span></span><span>skillbase</span></Link><Link className="detail-back" href="/">← 카탈로그</Link></header><div className="detail-loading" role="status">{status || "Skill 상세 정보를 불러오는 중입니다."}</div></main>;

  const track = (event: string) => {
    void fetch("/api/usage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ skillId: skill.id, event }) }).catch(() => undefined);
  };
  const prepare = async () => {
    try { await navigator.clipboard.writeText(prompt); } catch { /* clipboard can be blocked */ }
    setStatus("프롬프트를 클립보드에 복사했습니다. 외부 앱에 붙여넣기 전 내용을 확인하세요.");
    track("copy");
  };
  const applyInput = () => {
    setPrompt(skill.prompt.replace(/\{\{[^}]+\}\}/g, input.trim() || "[여기에 작업 입력값을 넣으세요]"));
    setStatus("입력값을 프롬프트에 반영했습니다. 실행 전에 결과를 확인하세요.");
  };
  const toggleFavorite = async () => {
    const next = !favorite;
    const response = await fetch("/api/favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ skillId: skill.id, active: next }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setStatus(payload.error ?? "로그인이 필요합니다."); return; }
    setFavorite(next);
    setStatus(next ? "즐겨찾기에 저장했습니다." : "즐겨찾기에서 제거했습니다.");
  };
  const openApp = async () => {
    await prepare();
    if (window.confirm("지원 앱을 열까요? 프롬프트는 복사되며 앱에 자동 전송되지는 않습니다.")) {
      track("open");
      window.open(skill.appUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main className="detail-shell">
      <header className="detail-topbar"><Link prefetch={false} className="brand" href="/" aria-label="skillbase 홈" onClick={(event) => { event.preventDefault(); window.location.assign("/"); }}><span className="brand-mark">s<span>·</span></span><span>skillbase</span></Link><Link className="detail-back" href="/">← 카탈로그</Link></header>
      <article className="detail-page">
        <div className="detail-heading"><div className="detail-monogram">{skill.name.slice(0, 2).toUpperCase()}</div><div><p className="section-kicker">{skill.category}</p><h1>{skill.name}</h1><p>{skill.description}</p>{skill.summaryKo && <p className="detail-summary"><strong>한국어 요약</strong>{skill.summaryKo}</p>}</div><button className={`favorite-button ${favorite ? "active" : ""}`} onClick={() => void toggleFavorite()} aria-label="즐겨찾기">{favorite ? "★" : "☆"}</button></div>
        <div className="detail-badges"><span>{verificationLabel(skill.verificationStatus)}</span><span>권한 위험도 {skill.risk}</span><span>{skill.region} · {skill.sourceType}</span><span>라이선스 {skill.license ?? "미상"}</span></div>
        <div className="detail-source"><span>원본 출처</span><a href={skill.sourceUrl} target="_blank" rel="noreferrer">{skill.source} ↗</a></div>
        <div className="detail-grid">
          <section className="detail-card"><div className="detail-card-title"><span>01</span><h2>설치와 호환성</h2></div><p>설치 전에 명령어와 필요한 플랫폼을 확인하세요. 실제 설치는 사용자의 로컬 환경에서 실행됩니다.</p><div className="detail-code"><code>{skill.install}</code><button onClick={() => { void navigator.clipboard?.writeText(skill.install); setStatus("설치 명령어를 복사했습니다."); }}>복사</button></div><div className="detail-chip-row">{skill.compatibility.map((item) => <span key={item}>{item}</span>)}</div></section>
          <section className="detail-card"><div className="detail-card-title"><span>02</span><h2>프롬프트 준비</h2></div><label htmlFor="detail-input">작업 입력값</label><textarea id="detail-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="이 Skill로 처리할 작업을 입력하세요." /><button className="detail-secondary" onClick={applyInput}>입력값 반영</button><label htmlFor="detail-prompt">실행 전 미리보기</label><textarea id="detail-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} /><div className="detail-actions"><button className="detail-secondary" onClick={() => void prepare()}>프롬프트 복사</button><button className="detail-primary" onClick={() => void openApp()}>복사 후 앱 열기 ↗</button></div></section>
        </div>
        <section className="verification-panel"><div><strong>검증 정보</strong><span>{verificationLabel(skill.verificationStatus)}</span></div><p>{skill.verificationSummary ?? "검증 상세 요약이 아직 기록되지 않았습니다. 원본과 권한을 직접 확인하세요."}</p><dl><div><dt>원본 링크</dt><dd>{skill.sourceLinkStatus === "ok" ? "정상 응답" : skill.sourceLinkStatus === "broken" ? "확인 필요" : "최근 점검 정보 없음"}</dd></div><div><dt>최근 검증</dt><dd>{skill.verificationUpdatedAt ?? "기록 없음"}</dd></div><div><dt>최근 업데이트</dt><dd>{skill.updatedAt ?? "기록 없음"}</dd></div></dl>{skill.licensePrevious && <p className="detail-warning">라이선스 변경 감지: {skill.licensePrevious} → {skill.license ?? "미상"}</p>}</section>
        <p className="detail-safety">자동 붙여넣기나 실행은 브라우저 보안상 외부 앱에 직접 전송하지 않습니다. 복사된 프롬프트를 확인한 뒤 사용자가 직접 붙여넣으세요.</p>
        {status && <p className="detail-status" role="status">{status}</p>}
        <div className="detail-footer-links"><Link href="/">다른 Skill 탐색하기 →</Link><a href={skill.sourceUrl} target="_blank" rel="noreferrer">원본 저장소 확인 ↗</a></div>
      </article>
    </main>
  );
}
