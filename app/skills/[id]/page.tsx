import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedSkill } from "../../../lib/sync";
import { runtimeEnv } from "../../../lib/runtime-env";
import SkillDetailClient from "./SkillDetailClient";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function loadSkill(id: string) {
  if (!runtimeEnv.DB) return null;
  return getPublishedSkill(runtimeEnv.DB, id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const skill = await loadSkill(id);
  if (!skill) return { title: "Skill을 찾을 수 없습니다 · skillbase" };
  return {
    title: `${skill.name} · skillbase`,
    description: skill.description,
    openGraph: { title: `${skill.name} · skillbase`, description: skill.description, type: "article" },
    twitter: { card: "summary", title: `${skill.name} · skillbase`, description: skill.description },
  };
}

export default async function SkillDetailPage({ params }: PageProps) {
  const { id } = await params;
  const skill = await loadSkill(id);
  if (!skill) notFound();
  return <SkillDetailClient skill={skill} />;
}
