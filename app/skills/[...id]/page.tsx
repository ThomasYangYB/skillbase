import type { Metadata } from "next";
import SkillDetailClient from "./SkillDetailClient";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string[] }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const name = decodeURIComponent(id.at(-1) ?? "Skill").replace(/[-_]/g, " ");
  return {
    title: `${name} · skillbase`,
    description: "원본 출처, 설치 경로, 검증 정보와 함께 확인하는 AI Skill 상세 페이지입니다.",
  };
}

export default async function SkillDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <SkillDetailClient skillId={id.join("/")} />;
}
