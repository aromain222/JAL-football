import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getViewerContext } from "@/lib/data/queries";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { WorkspaceRoleSwitcher } from "@/components/workspace-role-switcher";
import { LogoutButton } from "@/components/auth/logout-button";
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
  const { profile, team } = await getViewerContext();
  const currentRole = normalizeWorkspaceRole(profile.role) ?? WORKSPACE_ROLE_OPTIONS[0];

  return (
    <div className="px-4 py-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-6 lg:flex-row">
        <aside className="shell-panel relative flex w-full flex-col gap-5 overflow-hidden p-4 lg:sticky lg:top-6 lg:w-[286px] lg:self-start lg:p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(211,178,108,0.14),_transparent_68%)]" />

          {/* Brand */}
          <div className="scouting-shell-badge">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner">
                <ShieldCheck className="h-5 w-5 text-[#f0d69a]" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-[#f3dfaf]/80">Football Ops</p>
                <h1 className="mt-0.5 text-[1.65rem] font-semibold tracking-tight text-white">Portal Board</h1>
              </div>
            </div>
            <div className="mt-5 rounded-[20px] border border-white/10 bg-white/8 px-4 py-3">
              <p className="text-sm font-medium text-white">{team.name}</p>
              <p className="mt-0.5 text-[12px] text-[#d7e0d3]/65">{currentRole} · Transfer portal eval</p>
            </div>
          </div>

          {/* Nav */}
          <div className="grid gap-2">
            <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              Navigation
            </div>
            <AppSidebarNav items={navigation} />
          </div>

          {/* Footer */}
          <div className="mt-auto pt-2">
            <LogoutButton />
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
