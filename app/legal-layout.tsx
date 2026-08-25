import Link from "next/link";

export function LegalLayout({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="legal-shell">
      <header className="legal-topbar">
        <Link className="brand" href="/" aria-label="skillbase 홈">
          <span className="brand-mark">s<span>·</span></span>
          <span>skillbase</span>
        </Link>
        <Link className="legal-back" href="/">카탈로그로 돌아가기 ↗</Link>
      </header>
      <article className="legal-content">
        <p className="section-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>
        <div className="legal-notice">이 문서는 서비스 운영을 위한 안내 초안입니다. 공개 운영 전 실제 수집 항목과 법적 의무를 검토해 최종 문구를 확정하세요.</div>
        <div className="legal-body">{children}</div>
      </article>
    </main>
  );
}
