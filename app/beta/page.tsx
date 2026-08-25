"use client";

import Link from "next/link";
import { useState } from "react";

export default function BetaPage() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/beta/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, note, consent }) });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "베타 신청을 접수하지 못했습니다.");
      setStatus(payload.message ?? "베타 신청이 접수되었습니다.");
      setEmail("");
      setNote("");
      setConsent(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "베타 신청을 접수하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="beta-shell">
      <header className="legal-topbar">
        <Link className="brand" href="/" aria-label="skillbase 홈"><span className="brand-mark">s<span>·</span></span><span>skillbase</span></Link>
        <Link className="legal-back" href="/">카탈로그로 돌아가기 ↗</Link>
      </header>
      <section className="beta-content">
        <p className="section-kicker">PRIVATE BETA</p>
        <h1>더 안전한 AI Skill 카탈로그를 먼저 사용해보세요.</h1>
        <p>베타 신청을 남기면 운영자가 접근 정책과 서비스 목적에 맞는지 확인한 뒤 초대 대상 목록에 등록합니다. 승인과 Site 접근 허용은 별도 단계입니다.</p>
        <div className="beta-card">
          <label>이메일 주소<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label>사용 목적 <span className="beta-optional">선택</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="예: 팀의 개발·문서 Skill을 비교하고 싶습니다." maxLength={600} /></label>
          <label className="beta-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> <span>베타 운영 안내와 개인정보처리방침을 읽고 신청 정보 처리에 동의합니다.</span></label>
          <button className="primary-button" type="button" disabled={busy || !email || !consent} onClick={() => void submit()}>{busy ? "접수 중..." : "베타 신청하기"}</button>
          {status && <p className="beta-status" role="status">{status}</p>}
        </div>
        <p className="beta-footnote"><Link href="/privacy">개인정보처리방침</Link> · <Link href="/terms">이용약관</Link> · 신청은 하루 3건까지 가능합니다.</p>
      </section>
    </main>
  );
}
