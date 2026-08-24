"use client";

import { useMemo, useState } from "react";

type Skill = {
  id: string;
  name: string;
  monogram: string;
  category: string;
  description: string;
  tags: string[];
  compatibility: string[];
  rating: string;
  installs: string;
  updated: string;
  risk: "낮음" | "주의";
  accent: string;
  prompt: string;
  install: string;
  appUrl: string;
};

const categories = [
  { label: "전체", count: 128 },
  { label: "개발·IT", count: 42 },
  { label: "디자인·크리에이티브", count: 24 },
  { label: "문서·사무", count: 19 },
  { label: "리서치·데이터", count: 17 },
  { label: "콘텐츠·마케팅", count: 14 },
  { label: "업무 자동화", count: 12 },
];

const skills: Skill[] = [
  {
    id: "pr-guardian",
    name: "PR Guardian",
    monogram: "PG",
    category: "개발·IT",
    description: "코드 변경을 읽고 누락된 테스트와 잠재적 버그를 찾아냅니다.",
    tags: ["코드 리뷰", "GitHub", "테스트"],
    compatibility: ["Codex", "Claude", "Cursor"],
    rating: "4.9",
    installs: "12.4k",
    updated: "2일 전",
    risk: "낮음",
    accent: "violet",
    prompt:
      "너는 시니어 코드 리뷰어다. 아래 변경사항을 검토하고, 실제로 수정이 필요한 이슈만 심각도 순서로 정리해라. 각 이슈에는 파일, 근거, 수정 제안을 포함해라.\n\n변경사항:\n{{diff}}",
    install: "npx skills add skillbase/pr-guardian",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "brief-studio",
    name: "Brief Studio",
    monogram: "BS",
    category: "문서·사무",
    description: "긴 문서를 임원용 브리핑과 실행 항목으로 압축합니다.",
    tags: ["요약", "문서", "액션 아이템"],
    compatibility: ["ChatGPT", "Claude", "Gemini"],
    rating: "4.8",
    installs: "8.1k",
    updated: "5일 전",
    risk: "낮음",
    accent: "orange",
    prompt:
      "다음 문서를 1페이지 브리핑으로 바꿔라. 먼저 핵심 결론 3개를 쓰고, 그다음 사실과 의견을 구분한 요약, 결정이 필요한 항목, 담당자와 마감일이 있는 액션 아이템을 표로 정리해라.\n\n문서:\n{{document}}",
    install: "npx skills add skillbase/brief-studio",
    appUrl: "https://claude.ai/",
  },
  {
    id: "signal-scout",
    name: "Signal Scout",
    monogram: "SS",
    category: "리서치·데이터",
    description: "여러 출처를 비교해 시장 신호와 반대 증거를 함께 정리합니다.",
    tags: ["리서치", "출처 비교", "시장조사"],
    compatibility: ["ChatGPT", "Perplexity", "Claude"],
    rating: "4.7",
    installs: "6.7k",
    updated: "1주 전",
    risk: "주의",
    accent: "blue",
    prompt:
      "다음 질문을 조사하라. 최신 출처를 우선하고, 각 주장 옆에 출처 링크를 달아라. 확인되지 않은 내용은 추정이라고 명시하고, 결론을 뒤집을 수 있는 반대 증거도 마지막에 정리해라.\n\n질문:\n{{question}}",
    install: "npx skills add skillbase/signal-scout",
    appUrl: "https://www.perplexity.ai/",
  },
  {
    id: "pixel-brief",
    name: "Pixel Brief",
    monogram: "PB",
    category: "디자인·크리에이티브",
    description: "모호한 디자인 요청을 개발 가능한 화면 명세로 변환합니다.",
    tags: ["UI/UX", "디자인 명세", "Figma"],
    compatibility: ["Claude", "ChatGPT", "Cursor"],
    rating: "4.9",
    installs: "5.9k",
    updated: "3일 전",
    risk: "낮음",
    accent: "pink",
    prompt:
      "다음 디자인 요청을 개발자가 바로 사용할 수 있는 UI 명세로 바꿔라. 사용자 목표, 화면 구조, 상태, 컴포넌트, 반응형 규칙, 접근성 요구사항을 빠뜨리지 마라.\n\n요청:\n{{brief}}",
    install: "npx skills add skillbase/pixel-brief",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "flow-forge",
    name: "Flow Forge",
    monogram: "FF",
    category: "업무 자동화",
    description: "반복 업무를 단계별 워크플로로 쪼개고 자동화 후보를 표시합니다.",
    tags: ["워크플로", "자동화", "프로세스"],
    compatibility: ["Codex", "Claude", "Cursor"],
    rating: "4.6",
    installs: "4.2k",
    updated: "8일 전",
    risk: "주의",
    accent: "green",
    prompt:
      "다음 업무를 입력→판단→출력 단계의 워크플로로 분석하라. 자동화 가능한 단계, 사람이 승인해야 하는 단계, 필요한 도구와 실패 시 복구 방법을 구분해라.\n\n업무:\n{{task}}",
    install: "npx skills add skillbase/flow-forge",
    appUrl: "https://claude.ai/",
  },
  {
    id: "campaign-kit",
    name: "Campaign Kit",
    monogram: "CK",
    category: "콘텐츠·마케팅",
    description: "하나의 캠페인 브리프를 채널별 콘텐츠 묶음으로 확장합니다.",
    tags: ["콘텐츠", "SNS", "캠페인"],
    compatibility: ["ChatGPT", "Claude", "Gemini"],
    rating: "4.5",
    installs: "3.8k",
    updated: "12일 전",
    risk: "낮음",
    accent: "yellow",
    prompt:
      "다음 캠페인 브리프를 바탕으로 채널별 콘텐츠를 작성해라. 각 콘텐츠는 타깃, 핵심 메시지, CTA, 권장 길이를 함께 제시하고 과장된 성과 약속은 제거해라.\n\n브리프:\n{{brief}}",
    install: "npx skills add skillbase/campaign-kit",
    appUrl: "https://chatgpt.com/",
  },
];

function CheckIcon() {
  return <span className="check-icon" aria-hidden="true">✓</span>;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);

  const filteredSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return skills.filter((skill) => {
      const matchesCategory = activeCategory === "전체" || skill.category === activeCategory;
      const searchable = [skill.name, skill.category, skill.description, ...skill.tags].join(" ").toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [activeCategory, query]);

  const openSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    setCopied(false);
    setVerified(false);
  };

  const copyPrompt = async () => {
    if (!selectedSkill) return;
    try {
      await navigator.clipboard.writeText(selectedSkill.prompt);
    } catch {
      // Clipboard access can be blocked outside a secure context; the UI still confirms the intent.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const copyAndOpen = async () => {
    if (!selectedSkill) return;
    await copyPrompt();
    window.open(selectedSkill.appUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="skillbase 홈">
          <span className="brand-mark">s<span>·</span></span>
          <span>skillbase</span>
        </a>
        <nav className="main-nav" aria-label="주요 메뉴">
          <a className="active" href="#explore">탐색</a>
          <a href="#verification">검증 리포트</a>
          <a href="#submit">Skill 등록</a>
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="알림">♧</button>
          <button className="avatar" aria-label="프로필">J</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> 검증된 AI 워크플로</p>
          <h1>AI Skill을 찾고,<br /><em>바로 실행하세요.</em></h1>
          <p className="hero-description">좋은 Skill은 많지만, 믿고 설치할 수 있는 곳은 부족하니까.<br />호환성부터 보안까지 확인된 Skills를 한 곳에서 탐색하세요.</p>
          <div className="hero-search">
            <span className="search-symbol" aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="무엇을 자동화하고 싶나요?"
              aria-label="Skill 검색"
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="popular-searches">
            <span>인기 검색</span>
            <button onClick={() => setQuery("코드 리뷰")}>코드 리뷰</button>
            <button onClick={() => setQuery("요약")}>문서 요약</button>
            <button onClick={() => setQuery("리서치")}>시장 리서치</button>
          </div>
        </div>
        <div className="hero-art" aria-label="검증 완료를 상징하는 일러스트" role="img">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="hero-card hero-card-back">prompt<br />→ output</div>
          <div className="hero-card hero-card-front">
            <span className="card-check"><CheckIcon /></span>
            <strong>검증 완료</strong>
            <span>compatibility · security</span>
          </div>
          <span className="spark spark-one">✦</span>
          <span className="spark spark-two">✦</span>
        </div>
      </section>

      <section className="trust-strip" id="verification">
        <div><span className="strip-number">128</span><span>검증된 Skills</span></div>
        <div><span className="strip-number">14</span><span>지원 플랫폼</span></div>
        <div><span className="strip-number">3.2k</span><span>이번 달 설치</span></div>
        <div className="trust-note"><CheckIcon /><span>모든 Skill은 권한과 호환성을 확인합니다.</span></div>
      </section>

      <section className="explore-layout" id="explore">
        <aside className="sidebar">
          <div className="sidebar-heading"><span>카테고리</span><button aria-label="카테고리 설정">•••</button></div>
          <div className="category-list">
            {categories.map((category, index) => (
              <button
                key={category.label}
                className={`category-button ${activeCategory === category.label ? "selected" : ""}`}
                onClick={() => setActiveCategory(category.label)}
              >
                <span><span className={`category-dot dot-${index}`} />{category.label}</span>
                <span className="category-count">{category.count}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-divider" />
          <p className="sidebar-label">빠른 필터</p>
          <button className="filter-link"><span>✦</span> 검증 완료만 보기</button>
          <button className="filter-link"><span>◌</span> 무료 Skill만 보기</button>
          <div className="side-tip">
            <span className="tip-icon">✳</span>
            <strong>검증 리포트가 궁금한가요?</strong>
            <p>Skill마다 설치 전 위험 요소와 테스트 결과를 공개합니다.</p>
            <a href="#verification">자세히 보기 ↗</a>
          </div>
        </aside>

        <div className="catalog">
          <div className="catalog-heading">
            <div>
              <p className="section-kicker">CURATED FOR YOU</p>
              <h2>{activeCategory === "전체" ? "지금 많이 쓰는 Skills" : activeCategory}</h2>
            </div>
            <div className="catalog-controls">
              <span>{filteredSkills.length}개 표시</span>
              <button className="sort-button">추천순 <span>⌄</span></button>
            </div>
          </div>

          {filteredSkills.length > 0 ? (
            <div className="skill-grid">
              {filteredSkills.map((skill) => (
                <article className="skill-card" key={skill.id}>
                  <div className="skill-card-top">
                    <div className={`skill-logo ${skill.accent}`}>{skill.monogram}</div>
                    <div className="skill-card-title">
                      <div className="title-line"><h3>{skill.name}</h3><span className="verified-badge">✓</span></div>
                      <p>{skill.category}</p>
                    </div>
                    <button className="more-button" aria-label={`${skill.name} 더보기`}>•••</button>
                  </div>
                  <p className="skill-description">{skill.description}</p>
                  <div className="tag-row">{skill.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <div className="skill-meta">
                    <span className="rating">★ {skill.rating}</span>
                    <span>{skill.installs} 설치</span>
                    <span>업데이트 {skill.updated}</span>
                  </div>
                  <div className="compatibility-row">
                    <span className="compatibility-label">호환</span>
                    {skill.compatibility.map((platform) => <span key={platform} className="platform-chip">{platform}</span>)}
                  </div>
                  <div className="card-footer">
                    <span className={`risk risk-${skill.risk === "낮음" ? "low" : "medium"}`}><span />권한 위험도 {skill.risk}</span>
                    <button className="view-button" onClick={() => openSkill(skill)}>상세 보기 <span>↗</span></button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><strong>아직 맞는 Skill을 찾지 못했어요.</strong><span>다른 검색어 또는 카테고리로 다시 찾아보세요.</span></div>
          )}

          <div className="catalog-footer"><span>더 많은 Skill이 매주 추가됩니다.</span><button>전체 Skill 보기 <span>→</span></button></div>
        </div>
      </section>

      <section className="submit-banner" id="submit">
        <div><span className="banner-icon">+</span><div><p className="section-kicker">BUILD THE LIBRARY</p><h2>직접 만든 Skill도 등록하세요.</h2></div></div>
        <button>등록 시작하기 <span>↗</span></button>
      </section>

      <footer className="footer"><div className="brand"><span className="brand-mark">s<span>·</span></span><span>skillbase</span></div><span>AI Skills를 더 안전하고 쉽게.</span><span>© 2026 skillbase</span></footer>

      {selectedSkill && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedSkill(null)}>
          <section className="skill-modal" role="dialog" aria-modal="true" aria-labelledby="skill-modal-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedSkill(null)} aria-label="닫기">×</button>
            <div className="modal-heading">
              <div className={`skill-logo ${selectedSkill.accent}`}>{selectedSkill.monogram}</div>
              <div><p className="section-kicker">{selectedSkill.category}</p><h2 id="skill-modal-title">{selectedSkill.name}</h2><p>{selectedSkill.description}</p></div>
            </div>
            <div className="modal-status"><span><CheckIcon /> 호환성 확인됨</span><span><CheckIcon /> 권한 위험도 {selectedSkill.risk}</span><span>업데이트 {selectedSkill.updated}</span></div>
            <div className="modal-columns">
              <div className="modal-block"><div className="block-title"><span>01</span><h3>설치</h3></div><p>터미널에서 아래 명령을 실행하세요. 설치 후 Skillbase가 의존성과 등록 상태를 확인합니다.</p><div className="code-box"><code>{selectedSkill.install}</code><button onClick={() => navigator.clipboard?.writeText(selectedSkill.install)} aria-label="설치 명령어 복사">복사</button></div><button className="verify-button" onClick={() => setVerified(true)}>{verified ? "검증 완료 ✓" : "설치 후 검증 실행"}</button></div>
              <div className="modal-block"><div className="block-title"><span>02</span><h3>프롬프트 실행</h3></div><p>입력값을 채운 뒤 프롬프트를 복사하거나 지원 앱에서 바로 시작하세요.</p><div className="prompt-box"><textarea defaultValue={selectedSkill.prompt} aria-label="실행할 프롬프트" /></div><div className="prompt-actions"><button className="secondary-button" onClick={copyPrompt}>{copied ? "복사 완료 ✓" : "프롬프트 복사"}</button><button className="primary-button" onClick={copyAndOpen}>복사 후 앱 열기 ↗</button></div></div>
            </div>
            <p className="modal-footnote">자동 붙여넣기는 지원되는 브라우저 확장 프로그램에서 사용자의 클릭 후 실행됩니다.</p>
          </section>
        </div>
      )}
    </main>
  );
}
