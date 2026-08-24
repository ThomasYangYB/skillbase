"use client";

import { useEffect, useMemo, useState } from "react";

type Skill = {
  id: string;
  name: string;
  monogram: string;
  category: string;
  description: string;
  tags: string[];
  compatibility: string[];
  risk: "낮음" | "주의";
  region: "국내" | "해외";
  source: string;
  sourceUrl: string;
  sourceType: "공식" | "커뮤니티" | "디렉터리";
  trust: "원본 확인" | "검토 필요";
  accent: string;
  prompt: string;
  install: string;
  appUrl: string;
};

const skills: Skill[] = [
  {
    id: "korean-humanizer",
    name: "humanizer",
    monogram: "한",
    category: "한국어·문서",
    description: "한국어 글에서 AI가 쓴 듯한 표현을 찾아 자연스럽게 다듬습니다.",
    tags: ["한국어", "문체", "휴머나이저"],
    compatibility: ["Claude Code", "Cursor", "Windsurf", "Codex"],
    risk: "낮음",
    region: "국내",
    source: "DaleSeo/korean-skills",
    sourceUrl: "https://github.com/DaleSeo/korean-skills/tree/main/skills/humanizer",
    sourceType: "커뮤니티",
    trust: "원본 확인",
    accent: "violet",
    prompt:
      "다음 한국어 문장에서 AI가 쓴 듯한 표현, 과도한 수식어, 반복되는 문장 구조를 찾아라. 의미와 사실은 보존하고 자연스러운 대안만 제시해라.\n\n문장:\n{{text}}",
    install: "npx skills add daleseo/korean-skills@humanizer",
    appUrl: "https://claude.ai/",
  },
  {
    id: "korean-grammar-checker",
    name: "grammar-checker",
    monogram: "문",
    category: "한국어·문서",
    description: "한국어 맞춤법, 띄어쓰기, 문장부호를 점검하고 수정안을 제시합니다.",
    tags: ["맞춤법", "띄어쓰기", "교정"],
    compatibility: ["Claude Code", "Cursor", "Windsurf", "Codex"],
    risk: "낮음",
    region: "국내",
    source: "DaleSeo/korean-skills",
    sourceUrl: "https://github.com/DaleSeo/korean-skills/tree/main/skills/grammar-checker",
    sourceType: "커뮤니티",
    trust: "원본 확인",
    accent: "orange",
    prompt:
      "다음 한국어 문장을 맞춤법, 띄어쓰기, 문장부호 관점에서 점검해라. 수정 전후와 수정 이유를 표로 보여주고, 문제가 없으면 없다고 말해라.\n\n문장:\n{{text}}",
    install: "npx skills add daleseo/korean-skills@grammar-checker",
    appUrl: "https://claude.ai/",
  },
  {
    id: "korean-style-guide",
    name: "style-guide",
    monogram: "체",
    category: "한국어·문서",
    description: "한국어 문서의 용어, 문체, 표기 규칙을 일관되게 관리합니다.",
    tags: ["스타일 가이드", "용어", "문서 품질"],
    compatibility: ["Claude Code", "Cursor", "Windsurf", "Codex"],
    risk: "낮음",
    region: "국내",
    source: "DaleSeo/korean-skills",
    sourceUrl: "https://github.com/DaleSeo/korean-skills/tree/main/skills/style-guide",
    sourceType: "커뮤니티",
    trust: "원본 확인",
    accent: "blue",
    prompt:
      "다음 문서를 정해진 스타일 가이드에 맞춰 점검해라. 용어, 존댓말, 숫자·날짜 표기, 제목 체계를 분리해 일관성 문제와 수정안을 제시해라.\n\n문서:\n{{document}}",
    install: "npx skills add daleseo/korean-skills@style-guide",
    appUrl: "https://claude.ai/",
  },
  {
    id: "humanize-korean",
    name: "humanize-korean",
    monogram: "말",
    category: "한국어·문서",
    description: "한국어 AI 생성문에서 반복적인 패턴을 찾아 사람다운 문장으로 다듬습니다.",
    tags: ["한국어", "70개 패턴", "Codex"],
    compatibility: ["Codex", "GitHub Copilot"],
    risk: "낮음",
    region: "국내",
    source: "epoko77-ai/im-not-ai",
    sourceUrl: "https://github.com/epoko77-ai/im-not-ai/blob/main/codex/skills/humanize-korean/SKILL.md",
    sourceType: "커뮤니티",
    trust: "원본 확인",
    accent: "pink",
    prompt:
      "다음 한국어 초안을 내용과 사실은 유지한 채 자연스럽게 다듬어라. AI 문체로 보이는 패턴을 먼저 진단하고, 수정한 문장과 변경 이유를 함께 제시해라.\n\n초안:\n{{draft}}",
    install: "SKILL.md를 ~/.codex/skills/humanize-korean/에 복사",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "anthropic-frontend-design",
    name: "frontend-design",
    monogram: "FD",
    category: "디자인·크리에이티브",
    description: "템플릿 같은 화면을 피하고, 목적에 맞는 개성 있는 프론트엔드 인터페이스를 설계합니다.",
    tags: ["프론트엔드", "UI", "타이포그래피"],
    compatibility: ["Claude Code", "Codex", "Cursor", "Gemini"],
    risk: "주의",
    region: "해외",
    source: "Anthropic / skills",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/frontend-design",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "green",
    prompt:
      "이 제품 요구사항을 바탕으로 독창적이고 실제 구현 가능한 프론트엔드 방향을 제안해라. 시각적 콘셉트, 레이아웃, 타이포그래피, 색상, 상호작용, 반응형 규칙을 구체적으로 작성해라.\n\n요구사항:\n{{brief}}",
    install: "npx skills add https://github.com/anthropics/skills --skill frontend-design",
    appUrl: "https://claude.ai/",
  },
  {
    id: "anthropic-pdf",
    name: "pdf",
    monogram: "PDF",
    category: "문서·사무",
    description: "PDF 생성, 추출, 조작과 시각적 검토 작업을 위한 문서 스킬입니다.",
    tags: ["PDF", "문서", "렌더링"],
    compatibility: ["Claude Code", "Codex", "Cursor"],
    risk: "낮음",
    region: "해외",
    source: "Anthropic / skills",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/pdf",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "yellow",
    prompt:
      "다음 PDF 작업을 수행하기 전에 필요한 입력, 출력 형식, 페이지별 검토 항목을 먼저 정리해라. 누락되거나 확인이 필요한 부분은 실행 전에 질문해라.\n\n작업:\n{{task}}",
    install: "npx skills add https://github.com/anthropics/skills --skill pdf",
    appUrl: "https://claude.ai/",
  },
  {
    id: "anthropic-docx",
    name: "docx",
    monogram: "DOC",
    category: "문서·사무",
    description: "Word 문서를 만들고 편집하며 렌더링 결과를 확인합니다.",
    tags: ["Word", "DOCX", "문서 편집"],
    compatibility: ["Claude Code", "Codex", "Cursor"],
    risk: "낮음",
    region: "해외",
    source: "Anthropic / skills",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/docx",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "orange",
    prompt:
      "다음 문서 요구사항을 Word 문서 구조로 변환해라. 제목 계층, 표, 각주, 서식, 검토가 필요한 사실을 구분하고 최종 렌더링에서 확인할 항목을 적어라.\n\n요구사항:\n{{brief}}",
    install: "npx skills add https://github.com/anthropics/skills --skill docx",
    appUrl: "https://claude.ai/",
  },
  {
    id: "anthropic-pptx",
    name: "pptx",
    monogram: "PPT",
    category: "문서·사무",
    description: "프레젠테이션을 구성하고 슬라이드별 시각적 품질을 점검합니다.",
    tags: ["PPTX", "슬라이드", "발표자료"],
    compatibility: ["Claude Code", "Codex", "Cursor"],
    risk: "낮음",
    region: "해외",
    source: "Anthropic / skills",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/pptx",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "pink",
    prompt:
      "다음 발표 목적과 청중을 8장 이내의 슬라이드 구조로 바꿔라. 각 장에 제목, 핵심 메시지, 근거, 시각 자료 아이디어, 발표자 노트를 포함해라.\n\n발표 목적:\n{{brief}}",
    install: "npx skills add https://github.com/anthropics/skills --skill pptx",
    appUrl: "https://claude.ai/",
  },
  {
    id: "anthropic-xlsx",
    name: "xlsx",
    monogram: "XLS",
    category: "문서·사무",
    description: "스프레드시트를 만들고 수식·서식·데이터 품질을 점검합니다.",
    tags: ["Excel", "XLSX", "데이터"],
    compatibility: ["Claude Code", "Codex", "Cursor"],
    risk: "주의",
    region: "해외",
    source: "Anthropic / skills",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/xlsx",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "blue",
    prompt:
      "다음 스프레드시트 요구사항을 시트 구조, 열 정의, 수식, 검증 규칙, 서식으로 나눠 설계해라. 원본 데이터가 없으면 임의의 수치를 사실처럼 만들지 마라.\n\n요구사항:\n{{brief}}",
    install: "npx skills add https://github.com/anthropics/skills --skill xlsx",
    appUrl: "https://claude.ai/",
  },
  {
    id: "anthropic-skill-creator",
    name: "skill-creator",
    monogram: "SK",
    category: "개발·IT",
    description: "반복 작업을 재사용 가능한 Agent Skill로 설계하고 검증합니다.",
    tags: ["SKILL.md", "설계", "검증"],
    compatibility: ["Claude Code", "Codex", "Cursor"],
    risk: "주의",
    region: "해외",
    source: "Anthropic / skills",
    sourceUrl: "https://github.com/anthropics/skills/tree/main/skills/skill-creator",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "violet",
    prompt:
      "다음 반복 작업을 Agent Skill로 설계해라. SKILL.md의 목적, 트리거 조건, 단계별 절차, 필요한 리소스, 실패 조건, 안전 경계를 포함하고 최소 실행 예시를 제안해라.\n\n반복 작업:\n{{task}}",
    install: "npx skills add https://github.com/anthropics/skills --skill skill-creator",
    appUrl: "https://claude.ai/",
  },
  {
    id: "vercel-react-best-practices",
    name: "react-best-practices",
    monogram: "RB",
    category: "개발·IT",
    description: "React와 Next.js 코드의 성능 저하 원인을 규칙 기반으로 점검합니다.",
    tags: ["React", "Next.js", "성능"],
    compatibility: ["Claude Code", "Codex", "Cursor", "Windsurf"],
    risk: "낮음",
    region: "해외",
    source: "Vercel Labs / agent-skills",
    sourceUrl: "https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "green",
    prompt:
      "다음 React 또는 Next.js 변경사항을 성능 관점에서 검토해라. 워터폴, 번들 크기, 서버·클라이언트 경계, 캐시, 이미지와 폰트 문제를 우선순위와 근거로 정리해라.\n\n코드 또는 diff:\n{{code}}",
    install: "npx skills add vercel-labs/agent-skills --skill react-best-practices",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "vercel-web-design-guidelines",
    name: "web-design-guidelines",
    monogram: "WD",
    category: "디자인·크리에이티브",
    description: "웹 인터페이스의 접근성, UX, 성능과 디자인 품질을 점검합니다.",
    tags: ["접근성", "UX", "웹 품질"],
    compatibility: ["Claude Code", "Codex", "Cursor", "Windsurf"],
    risk: "낮음",
    region: "해외",
    source: "Vercel Labs / agent-skills",
    sourceUrl: "https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "orange",
    prompt:
      "다음 웹 화면을 접근성, 키보드 사용성, 모바일 대응, 인터랙션 피드백, 성능 관점에서 점검해라. 재현 가능한 문제만 심각도와 수정안으로 정리해라.\n\n화면 또는 코드:\n{{screen}}",
    install: "npx skills add vercel-labs/agent-skills --skill web-design-guidelines",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "vercel-optimize",
    name: "vercel-optimize",
    monogram: "VO",
    category: "개발·IT",
    description: "Vercel 프로젝트의 비용, 성능, 안정성과 캐시 구성을 감사합니다.",
    tags: ["Vercel", "비용", "캐시"],
    compatibility: ["Claude Code", "Codex", "Cursor"],
    risk: "주의",
    region: "해외",
    source: "Vercel Labs / agent-skills",
    sourceUrl: "https://github.com/vercel-labs/agent-skills/tree/main/skills/vercel-optimize",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "blue",
    prompt:
      "다음 Vercel 프로젝트를 비용, 캐시, 응답 성능, 안정성 관점에서 감사해라. 실제 설정과 로그에서 확인된 사실과 추정 사항을 구분하고 가장 큰 효과부터 제안해라.\n\n프로젝트 정보:\n{{project}}",
    install: "npx skills add vercel-labs/agent-skills --skill vercel-optimize",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "cloudflare",
    name: "cloudflare",
    monogram: "CF",
    category: "개발·IT",
    description: "Cloudflare Workers와 관련 플랫폼 기능을 활용하는 작업을 안내합니다.",
    tags: ["Workers", "Cloudflare", "배포"],
    compatibility: ["Claude Code", "Codex", "Cursor", "OpenCode"],
    risk: "주의",
    region: "해외",
    source: "Cloudflare / skills",
    sourceUrl: "https://github.com/cloudflare/skills/tree/main/skills/cloudflare",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "yellow",
    prompt:
      "다음 요구사항에 맞는 Cloudflare 구성안을 작성해라. 사용할 제품, 데이터 흐름, 인증, 배포 단계, 비용과 장애 시 복구 방법을 구분하고 공식 문서 확인이 필요한 부분을 표시해라.\n\n요구사항:\n{{brief}}",
    install: "npx skills add https://github.com/cloudflare/skills --skill cloudflare",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "cloudflare-agents-sdk",
    name: "agents-sdk",
    monogram: "AG",
    category: "개발·IT",
    description: "Cloudflare Agents SDK의 상태, RPC, MCP, 워크플로 기능을 활용합니다.",
    tags: ["Agents SDK", "MCP", "RPC"],
    compatibility: ["Claude Code", "Codex", "Cursor", "OpenCode"],
    risk: "주의",
    region: "해외",
    source: "Cloudflare / skills",
    sourceUrl: "https://github.com/cloudflare/skills/tree/main/skills/agents-sdk",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "pink",
    prompt:
      "다음 에이전트 요구사항을 Cloudflare Agents SDK 설계로 바꿔라. 상태 저장, 사용자 인증, RPC, MCP 도구, 장기 실행 작업, 관찰 가능성을 분리하고 코드 구조를 제안해라.\n\n요구사항:\n{{brief}}",
    install: "npx skills add https://github.com/cloudflare/skills --skill agents-sdk",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "cloudflare-ai-agent",
    name: "building-ai-agent-on-cloudflare",
    monogram: "AI",
    category: "업무 자동화",
    description: "Cloudflare 환경에서 AI 에이전트를 설계·구현하는 작업을 돕습니다.",
    tags: ["AI 에이전트", "Workers", "자동화"],
    compatibility: ["Claude Code", "Codex", "Cursor", "OpenCode"],
    risk: "주의",
    region: "해외",
    source: "Cloudflare / skills",
    sourceUrl: "https://github.com/cloudflare/skills/tree/main/skills/building-ai-agent-on-cloudflare",
    sourceType: "공식",
    trust: "원본 확인",
    accent: "violet",
    prompt:
      "다음 자동화 요구사항을 Cloudflare 기반 AI 에이전트 아키텍처로 설계해라. 모델 호출, 도구 권한, 상태, 비용 제한, 실패 복구와 인간 승인 지점을 포함해라.\n\n요구사항:\n{{brief}}",
    install: "npx skills add https://github.com/cloudflare/skills --skill building-ai-agent-on-cloudflare",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "mattpocock-tdd",
    name: "tdd",
    monogram: "TDD",
    category: "개발·IT",
    description: "수직 슬라이스와 행동 중심 테스트로 TDD 작업 흐름을 안내합니다.",
    tags: ["TDD", "테스트", "리팩터링"],
    compatibility: ["Claude Code", "Codex", "Cursor", "Windsurf"],
    risk: "낮음",
    region: "해외",
    source: "Matt Pocock / skills",
    sourceUrl: "https://www.skills.sh/mattpocock/skills/tdd",
    sourceType: "디렉터리",
    trust: "원본 확인",
    accent: "green",
    prompt:
      "다음 기능을 수직 슬라이스로 쪼개고 TDD 순서를 설계해라. 먼저 사용자 행동과 실패 조건을 테스트로 정의한 뒤, 작은 구현과 리팩터링 단계를 제시해라.\n\n기능:\n{{feature}}",
    install: "npx skills add https://github.com/mattpocock/skills --skill tdd",
    appUrl: "https://chatgpt.com/",
  },
  {
    id: "skillmd-code-reviewer",
    name: "code-reviewer",
    monogram: "CR",
    category: "개발·IT",
    description: "14개 이상 언어의 PR을 복잡도, 위험도, 품질 관점에서 구조적으로 리뷰합니다.",
    tags: ["코드 리뷰", "PR", "보안"],
    compatibility: ["Claude Code", "Codex", "Cursor"],
    risk: "주의",
    region: "해외",
    source: "SkillMD / alirezarezvani",
    sourceUrl: "https://skillmd.com/skills/alirezarezvani/code-reviewer",
    sourceType: "디렉터리",
    trust: "검토 필요",
    accent: "orange",
    prompt:
      "다음 diff를 코드 리뷰해라. 실제 수정이 필요한 문제만 심각도 순서로 정리하고 파일, 근거, 재현 조건, 수정 제안을 포함해라. 보안·성능·테스트 누락을 별도로 확인해라.\n\nDiff:\n{{diff}}",
    install: "npx -y skillmds add alirezarezvani/code-reviewer",
    appUrl: "https://chatgpt.com/",
  },
];

const categoryNames = ["전체", "개발·IT", "디자인·크리에이티브", "문서·사무", "리서치·데이터", "콘텐츠·마케팅", "한국어·문서", "업무 자동화"];

function CheckIcon() {
  return <span className="check-icon" aria-hidden="true">✓</span>;
}

export default function Home() {
  const [catalogSkills, setCatalogSkills] = useState<Skill[]>(skills);
  const [activeCategory, setActiveCategory] = useState("전체");
  const [activeRegion, setActiveRegion] = useState<"전체" | "국내" | "해외">("전체");
  const [query, setQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ activeSkills: number; pendingReviews: number; latestRun?: { status?: string; finished_at?: string | null }; sources: unknown[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const response = await fetch("/api/skills?limit=200", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { skills?: Skill[] };
        if (!cancelled && Array.isArray(payload.skills) && payload.skills.length > 0) setCatalogSkills(payload.skills);
      } catch {
        // The curated fallback keeps the catalog useful when D1 has not synced yet.
      }
    };
    const loadSyncSummary = async () => {
      try {
        const response = await fetch("/api/sync", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { activeSkills: number; pendingReviews: number; latestRun?: { status?: string; finished_at?: string | null }; sources: unknown[] };
        if (!cancelled) setSyncSummary(payload);
      } catch {
        // Sync status is informative and should not block catalog rendering.
      }
    };
    void loadCatalog();
    void loadSyncSummary();
    return () => { cancelled = true; };
  }, []);

  const categories = categoryNames.map((label) => ({
    label,
    count: label === "전체" ? catalogSkills.length : catalogSkills.filter((skill) => skill.category === label).length,
  }));
  const platformCount = new Set(catalogSkills.flatMap((skill) => skill.compatibility)).size;
  const sourceCount = new Set(catalogSkills.map((skill) => skill.source)).size;

  const filteredSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalogSkills.filter((skill) => {
      const matchesCategory = activeCategory === "전체" || skill.category === activeCategory;
      const matchesRegion = activeRegion === "전체" || skill.region === activeRegion;
      const searchable = [skill.name, skill.category, skill.description, skill.source, skill.region, ...skill.tags, ...skill.compatibility].join(" ").toLowerCase();
      return matchesCategory && matchesRegion && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [activeCategory, activeRegion, catalogSkills, query]);

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
          <a href="#verification">수집 상태</a>
          <a href="/admin">운영자 큐</a>
          <a href="#submit">Skill 등록</a>
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="알림">♧</button>
          <button className="avatar" aria-label="프로필">J</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> 원본 출처를 확인한 AI 워크플로</p>
          <h1>AI Skill을 찾고,<br /><em>바로 실행하세요.</em></h1>
          <p className="hero-description">공개 저장소와 디렉터리의 실제 Skill을 모아 출처와 설치 경로를 보여줍니다.<br />설치 전 권한을 직접 검토하고, 프롬프트는 복사해 바로 시작하세요.</p>
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
            <button onClick={() => setQuery("한국어")}>한국어</button>
            <button onClick={() => setQuery("React")}>React</button>
          </div>
        </div>
        <div className="hero-art" aria-label="원본 출처 확인을 상징하는 일러스트" role="img">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="hero-card hero-card-back">prompt<br />→ output</div>
          <div className="hero-card hero-card-front">
            <span className="card-check"><CheckIcon /></span>
            <strong>원본 확인</strong>
            <span>compatibility · security</span>
          </div>
          <span className="spark spark-one">✦</span>
          <span className="spark spark-two">✦</span>
        </div>
      </section>

      <section className="trust-strip" id="verification">
        <div><span className="strip-number">{catalogSkills.length}</span><span>수집된 Skills</span></div>
        <div><span className="strip-number">{platformCount}</span><span>호환 플랫폼</span></div>
        <div><span className="strip-number">{sourceCount}</span><span>원본 출처</span></div>
        <div className="trust-note"><CheckIcon /><span>{syncSummary?.pendingReviews ? `검토 대기 ${syncSummary.pendingReviews}개 · 공개 전 확인 필요` : syncSummary?.latestRun ? "최근 자동 수집 완료 · 공개 전 확인 완료" : "매일 자동 수집 예약 · 공개 전 확인"}</span></div>
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
          <p className="sidebar-label">출처 필터</p>
          <button className={`filter-link ${activeRegion === "전체" ? "selected" : ""}`} onClick={() => setActiveRegion("전체")}><span>✦</span> 전체 출처</button>
          <button className={`filter-link ${activeRegion === "국내" ? "selected" : ""}`} onClick={() => setActiveRegion("국내")}><span>⌁</span> 국내 출처만</button>
          <button className={`filter-link ${activeRegion === "해외" ? "selected" : ""}`} onClick={() => setActiveRegion("해외")}><span>◌</span> 해외 출처만</button>
          <div className="side-tip" id="sync">
            <span className="tip-icon">✳</span>
            <strong>자동 수집 파이프라인</strong>
            <p>GitHub의 SKILL.md, skills.sh 리더보드, 국내 디렉터리를 매일 확인하고 표준 형식·중복·권한 신호를 검사합니다.</p>
            <span className="sync-state">{syncSummary?.pendingReviews ? `검토 대기 ${syncSummary.pendingReviews}개` : syncSummary?.latestRun?.status === "completed" ? "마지막 실행 성공" : syncSummary?.latestRun ? "일부 출처 확인 필요" : "첫 자동 수집 대기 중"}</span>
            <a href="/api/sync" target="_blank" rel="noreferrer">수집 상태 보기 ↗</a>
            <a href="/admin">운영자 검토 큐 열기 ↗</a>
          </div>
        </aside>

        <div className="catalog">
          <div className="catalog-heading">
            <div>
              <p className="section-kicker">CURATED FOR YOU</p>
              <h2>{activeCategory === "전체" ? `${activeRegion === "전체" ? "수집된" : activeRegion} Skills` : activeCategory}</h2>
              <p className="catalog-note">공개 원본 기준 초기 큐레이션 · 카드의 출처명을 누르면 원문을 확인할 수 있습니다.</p>
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
                      <div className="title-line"><h3>{skill.name}</h3><span className={`region-badge region-${skill.region === "국내" ? "kr" : "global"}`}>{skill.region}</span></div>
                      <p>{skill.category}</p>
                    </div>
                    <button className="more-button" aria-label={`${skill.name} 더보기`}>•••</button>
                  </div>
                  <p className="skill-description">{skill.description}</p>
                  <div className="tag-row">{skill.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <div className="skill-meta"><span className="rating">● {skill.trust}</span><a href={skill.sourceUrl} target="_blank" rel="noreferrer">{skill.source}</a><span>{skill.sourceType}</span></div>
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

          <div className="catalog-footer"><span>{syncSummary ? `${syncSummary.sources.length}개 출처를 주기적으로 확인합니다.` : "공개 원본 기준으로 계속 보강됩니다."}</span><button onClick={() => { setActiveCategory("전체"); setActiveRegion("전체"); setQuery(""); }}>전체 Skill 보기 <span>→</span></button></div>
        </div>
      </section>

      <section className="submit-banner" id="submit">
        <div><span className="banner-icon">+</span><div><p className="section-kicker">BUILD THE LIBRARY</p><h2>직접 만든 Skill도 등록하세요.</h2></div></div>
        <button>등록 시작하기 <span>↗</span></button>
      </section>

      <footer className="footer"><div className="brand"><span className="brand-mark">s<span>·</span></span><span>skillbase</span></div><span>AI Skills를 더 안전하고 쉽게.</span><span>© 2026 skillbase</span></footer>

      {selectedSkill && (
        <div className="modal-backdrop" role="presentation">
          <section className="skill-modal" role="dialog" aria-modal="true" aria-labelledby="skill-modal-title">
            <button className="modal-close" onClick={() => setSelectedSkill(null)} aria-label="닫기">×</button>
            <div className="modal-heading">
              <div className={`skill-logo ${selectedSkill.accent}`}>{selectedSkill.monogram}</div>
              <div><p className="section-kicker">{selectedSkill.category}</p><h2 id="skill-modal-title">{selectedSkill.name}</h2><p>{selectedSkill.description}</p></div>
            </div>
            <div className="modal-status"><span><CheckIcon /> {selectedSkill.trust}</span><span><CheckIcon /> 권한 검토 {selectedSkill.risk}</span><span>{selectedSkill.region} · {selectedSkill.sourceType}</span></div>
            <p className="modal-source">출처: <a href={selectedSkill.sourceUrl} target="_blank" rel="noreferrer">{selectedSkill.source}</a> ↗</p>
            <div className="modal-columns">
              <div className="modal-block"><div className="block-title"><span>01</span><h3>설치</h3></div><p>원본 출처의 설치 경로입니다. 실제 실행 권한과 파일 변경 내용을 확인한 뒤 설치하세요.</p><div className="code-box"><code>{selectedSkill.install}</code><button onClick={() => navigator.clipboard?.writeText(selectedSkill.install)} aria-label="설치 명령어 복사">복사</button></div><button className="verify-button" onClick={() => setVerified(true)}>{verified ? "내 환경 확인 표시됨 ✓" : "설치 후 확인 표시"}</button></div>
              <div className="modal-block"><div className="block-title"><span>02</span><h3>프롬프트 실행</h3></div><p>입력값을 채운 뒤 프롬프트를 복사하거나 지원 앱에서 바로 시작하세요.</p><div className="prompt-box"><textarea defaultValue={selectedSkill.prompt} aria-label="실행할 프롬프트" /></div><div className="prompt-actions"><button className="secondary-button" onClick={copyPrompt}>{copied ? "복사 완료 ✓" : "프롬프트 복사"}</button><button className="primary-button" onClick={copyAndOpen}>복사 후 앱 열기 ↗</button></div></div>
            </div>
            <p className="modal-footnote">자동 붙여넣기는 사용자의 클릭 후 클립보드에 복사하고 지원 앱을 엽니다. 실제 설치·권한 검증은 로컬 환경에서 확인하세요.</p>
          </section>
        </div>
      )}
    </main>
  );
}
