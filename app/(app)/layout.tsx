import Link from "next/link";
import { ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { getViewerContext, getWorkspaceMembers } from "@/lib/data/queries";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { WorkspaceRoleSwitcher } from "@/components/workspace-role-switcher";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { normalizeWorkspaceRole, WORKSPACE_ROLE_OPTIONS } from "@/lib/workspace-role";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/needs", label: "Needs", icon: "needs" },
  { href: "/players", label: "Players", icon: "players" },
  { href: "/shortlist", label: "Shortlist", icon: "shortlist" },
  { href: "/identity", label: "Identity", icon: "identity" }
] as const;

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const [{ profile, team }, members] = await Promise.all([getViewerContext(), getWorkspaceMembers()]);
  const currentRole = normalizeWorkspaceRole(profile.role) ?? WORKSPACE_ROLE_OPTIONS[0];

  return (
    <div className="px-4 py-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-6 lg:flex-row">
        <aside className="shell-panel relative flex w-full flex-col gap-5 overflow-hidden p-4 lg:sticky lg:top-6 lg:w-[318px] lg:self-start lg:p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(211,178,108,0.14),_transparent_68%)]" />
          <div className="scouting-shell-badge">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner">
                <ShieldCheck className="h-6 w-6 text-[#f0d69a]" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-[#f3dfaf]/80">Football Ops Workspace</p>
                <h1 className="mt-1 text-[1.85rem] font-semibold tracking-tight">Portal Board</h1>
                <p className="mt-2 max-w-[14rem] text-sm leading-6 text-[#d7e0d3]/75">
                  Transfer board, review flow, and shortlist control in one place.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 rounded-[24px] border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-medium text-white">Board workspace</p>
              <p className="mt-1 text-sm text-[#d7e0d3]/75">{team.name} • {currentRole}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.26em] text-[#f3dfaf]/65">Mode</div>
                  <div className="mt-1 text-sm font-medium text-white">Internal Board</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.26em] text-[#f3dfaf]/65">Focus</div>
                  <div className="mt-1 text-sm font-medium text-white">Portal Eval</div>
                </div>
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#f3dfaf]/72">Staff board</div>
                <div className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-[#d7e0d3]/72">
                  {members.length} coaches
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {members.slice(0, 4).map((member) => {
                  const displayRole = normalizeWorkspaceRole(member.role) ?? member.role;
                  const initials = member.full_name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/6 px-3 py-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-[#11261a] text-xs font-semibold text-[#f6e6bc]">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{member.full_name}</p>
                        <p className="truncate text-[10px] uppercase tracking-[0.24em] text-[#d7e0d3]/58">{displayRole}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              Workspace
            </div>
            <AppSidebarNav items={navigation} />
          </div>

          <div className="scouting-surface mt-auto rounded-[26px] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <Sparkles className="h-4 w-4 text-[#8a6a32]" />
              Workflow status
            </div>
            <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 p-3 text-sm leading-6 text-slate-600">
              <div className="flex items-center gap-2 text-slate-700">
                <UsersRound className="h-4 w-4" />
                Keyboard-first review flow enabled
              </div>
              <p className="mt-2">Use the board for search, triage, and shortlist movement without leaving the workspace.</p>
            </div>
            <div className="mt-4">
              <LogoutButton />
            </div>
          </div>
        </aside>

        <main className="flex-1 pb-6">
          <div className="rounded-[32px] border border-white/65 bg-white/42 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.07)] backdrop-blur-sm lg:p-5">
            <div className="mb-4">
              <WorkspaceRoleSwitcher currentRole={currentRole} />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
