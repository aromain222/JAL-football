import Link from "next/link";
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
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-[#e4e8e5] bg-white">
        <div className="px-5 py-5">
          <Link href="/dashboard" className="block">
            <p className="text-[13px] font-bold text-[#15542a]">JAL Football</p>
            <p className="mt-0.5 text-[11px] text-[#9ca3af]">{team.name}</p>
          </Link>
        </div>
        <div className="px-3"><div className="h-px bg-[#e4e8e5]" /></div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <AppSidebarNav items={navigation} />
        </div>
        <div className="px-3"><div className="h-px bg-[#e4e8e5]" /></div>
        <div className="px-4 py-4 grid gap-2">
          <WorkspaceRoleSwitcher currentRole={currentRole} />
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-white px-8 py-6">
        {children}
      </main>
    </div>
  );
}
