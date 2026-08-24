import type { Metadata } from "next";
import SkillDetailClient from "./SkillDetailClient";
import { getPublishedSkill } from "../../../lib/sync";
import { runtimeEnv } from "../../../lib/runtime-env";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string[] }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const skillId = id.join("/");
  const stored = runtimeEnv.DB ? await getPublishedSkill(runtimeEnv.DB, skillId) : null;
  const name = stored?.name ?? decodeURIComponent(id.at(-1) ?? "Skill").replace(/[-_]/g, " ");
  const description = stored?.summaryKo ?? stored?.description ?? "원본 출처, 설치 경로, 검증 정보와 함께 확인하는 AI Skill 상세 페이지입니다.";
  return {
    title: `${name} · skillbase`,
    description,
    openGraph: { title: `${name} · skillbase`, description, type: "article" },
    twitter: { card: "summary", title: `${name} · skillbase`, description },
  };
}

export default async function SkillDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <SkillDetailClient skillId={id.join("/")} />;
}
