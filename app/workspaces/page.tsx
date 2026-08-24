"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Workspace = { id: string; name: string; role: "owner" | "editor" | "viewer"; ownerEmail: string | null };
type WorkspaceDetails = Workspace & { items: Array<{ id: string; skill_id: string; name: string; category: string; summary_ko: string | null; note: string | null }>; members: Array<{ id: string; actor_email: string | null; role: string; status: string; invite_expires_at: string | null }> };

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState<WorkspaceDetails | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");
  const [status, setStatus] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  const loadWorkspaces = useCallback(async () => {
    const response = await fetch("/api/workspaces", { cache: "no-store" });
    const payload = await response.json() as { workspaces?: Workspace[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "비공개 공간을 불러오지 못했습니다.");
    const next = Array.isArray(payload.workspaces) ? payload.workspaces : [];
    setWorkspaces(next);
    setSelectedId((current) => current || next[0]?.id || "");
  }, []);

  const loadDetails = useCallback(async (id: string) => {
    if (!id) return;
    const response = await fetch(`/api/workspaces/detail?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = await response.json() as { workspace?: WorkspaceDetails; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "공간 상세 정보를 불러오지 못했습니다.");
    setDetails(payload.workspace ?? null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkspaces().catch((error) => setStatus(error instanceof Error ? error.message : "비공개 공간을 불러오지 못했습니다.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspaces]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDetails(selectedId).catch((error) => setStatus(error instanceof Error ? error.message : "공간 상세 정보를 불러오지 못했습니다.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetails, selectedId]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token) return;
    void fetch("/api/workspaces/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => {
        const payload = await response.json() as { workspaceId?: string; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "초대를 수락하지 못했습니다.");
        setSelectedId(payload.workspaceId ?? "");
        setStatus("비공개 공간 초대를 수락했습니다.");
        window.history.replaceState({}, "", "/workspaces");
        await loadWorkspaces();
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "초대를 수락하지 못했습니다."));
  }, [loadWorkspaces]);

  const create = async () => {
    setStatus("공간을 만드는 중...");
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      const payload = await response.json() as { workspace?: Workspace; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "공간을 만들지 못했습니다.");
      setName("");
      await loadWorkspaces();
      if (payload.workspace?.id) setSelectedId(payload.workspace.id);
      setStatus("비공개 공간을 만들었습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "공간을 만들지 못했습니다.");
    }
  };

  const invite = async () => {
    if (!selectedId) return;
    setStatus("초대 링크를 만드는 중...");
    try {
      const response = await fetch("/api/workspaces/members", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: selectedId, email, role: inviteRole }) });
      const payload = await response.json() as { inviteUrl?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "멤버 초대에 실패했습니다.");
      setEmail("");
      setInviteUrl(payload.inviteUrl ?? "");
      await loadDetails(selectedId);
      setStatus("초대 링크를 만들었습니다. 링크를 해당 이메일 사용자에게 전달하세요.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "멤버 초대에 실패했습니다.");
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setStatus("초대 링크를 복사했습니다.");
  };

  const removeItem = async (skillId: string) => {
    if (!selectedId) return;
    const response = await fetch(`/api/workspaces/items?workspaceId=${encodeURIComponent(selectedId)}&skillId=${encodeURIComponent(skillId)}`, { method: "DELETE" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return setStatus(payload.error ?? "Skill을 삭제하지 못했습니다.");
    await loadDetails(selectedId);
    setStatus("비공개 공간에서 Skill을 삭제했습니다.");
  };

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar"><Link prefetch={false} className="brand" href="/" aria-label="skillbase 홈"><span className="brand-mark">s<span>·</span></span><span>skillbase</span></Link><Link prefetch={false} className="workspace-back" href="/">카탈로그로 돌아가기 ↗</Link></header>
      <section className="workspace-hero"><p className="section-kicker">PRIVATE SPACES</p><h1>비공개 공간</h1><p>공개된 Skill을 팀별로 모아 메모와 함께 관리하세요. 공간과 메모는 멤버에게만 보입니다.</p></section>
      <section className="workspace-layout">
        <aside className="workspace-sidebar"><div className="workspace-section-title"><strong>내 공간</strong><span>{workspaces.length}</span></div>{workspaces.map((workspace) => <button key={workspace.id} className={selectedId === workspace.id ? "workspace-nav selected" : "workspace-nav"} onClick={() => setSelectedId(workspace.id)}><span>{workspace.name}</span><small>{workspace.role === "owner" ? "소유자" : workspace.role === "editor" ? "편집자" : "열람자"}</small></button>)}<div className="workspace-create"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="새 공간 이름" maxLength={80} /><button onClick={() => void create()}>공간 만들기</button></div></aside>
        <section className="workspace-main">{details ? <><div className="workspace-heading"><div><p className="section-kicker">{details.role === "owner" ? "OWNER SPACE" : "SHARED SPACE"}</p><h2>{details.name}</h2><p>멤버 {details.members.length}명 · Skill {details.items.length}개</p></div><Link className="workspace-primary-link" href="/">Skill 추가는 카탈로그에서 ↗</Link></div><div className="workspace-invite"><div><strong>멤버 초대</strong><p>초대 이메일과 일치하는 로그인 계정만 참여할 수 있습니다.</p></div><div className="workspace-invite-form"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="member@example.com" /><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "viewer" | "editor")} aria-label="초대 권한"><option value="viewer">열람자</option><option value="editor">편집자</option></select><button disabled={details.role !== "owner"} onClick={() => void invite()}>초대 링크 만들기</button></div>{inviteUrl && <div className="workspace-invite-result"><input readOnly value={inviteUrl} /><button onClick={() => void copyInvite()}>링크 복사</button></div>}</div><div className="workspace-item-list">{details.items.length === 0 ? <div className="workspace-empty"><strong>아직 저장한 Skill이 없습니다.</strong><span>Skill 상세 화면에서 비공개 공간에 추가할 수 있습니다.</span></div> : details.items.map((item) => <article className="workspace-item" key={item.id}><div><span className="workspace-item-category">{item.category}</span><h3>{item.name}</h3><p>{item.summary_ko ?? item.note ?? item.description}</p></div>{details.role !== "viewer" && <button onClick={() => void removeItem(item.skill_id)} aria-label={`${item.name} 삭제`}>삭제</button>}</article>)}</div></> : <div className="workspace-empty"><strong>공간을 선택하세요.</strong><span>개인 보관함은 로그인 후 자동으로 생성됩니다.</span></div>}{status && <p className="workspace-status" role="status">{status}</p>}</section>
      </section>
    </main>
  );
}
