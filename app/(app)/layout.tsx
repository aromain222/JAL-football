import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LogOut,
  ShieldCheck,
  Sparkles,
  UsersRound
} from "lucide-react";
import { getViewerContext } from "@/lib/data/queries";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase/server";

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
  if (hasSupabaseEnv()) {
    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
  }

  await getViewerContext();

  return (
    <div className="px-4 py-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-6 lg:flex-row">
        <aside className="shell-panel relative flex w-full flex-col gap-5 overflow-hidden p-4 lg:sticky lg:top-6 lg:w-[318px] lg:self-start lg:p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_68%)]" />
          <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(165deg,#09111f_0%,#0d2740_48%,#0e7490_100%)] p-5 text-white shadow-[0_30px_70px_rgba(8,15,33,0.35)]">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner">
                <ShieldCheck className="h-6 w-6 text-cyan-200" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-100/75">Football Ops Workspace</p>
                <h1 className="mt-1 text-[1.85rem] font-semibold tracking-tight">Portal Board</h1>
                <p className="mt-2 max-w-[14rem] text-sm leading-6 text-cyan-50/75">
                  Transfer board, review flow, and shortlist control in one place.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 rounded-[24px] border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-medium text-white">Staff workspace</p>
              <p className="mt-1 text-sm text-cyan-100/75">Signed-in staff access</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.26em] text-cyan-100/65">Mode</div>
                  <div className="mt-1 text-sm font-medium text-white">Internal Board</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.26em] text-cyan-100/65">Focus</div>
                  <div className="mt-1 text-sm font-medium text-white">Portal Eval</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
              Workspace
            </div>
            <AppSidebarNav items={navigation} />
          </div>

          <div className="mt-auto rounded-[26px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(241,245,249,0.92))] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <Sparkles className="h-4 w-4 text-cyan-700" />
              Workflow status
            </div>
            <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 p-3 text-sm leading-6 text-slate-600">
              <div className="flex items-center gap-2 text-slate-700">
                <UsersRound className="h-4 w-4" />
                Keyboard-first review flow enabled
              </div>
              <p className="mt-2">Use the board for search, triage, and shortlist movement without leaving the workspace.</p>
            </div>
            <Button asChild className="mt-4 w-full justify-between">
              <Link href="/login">
                Log out
                <LogOut className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>

        <main className="flex-1 pb-6">
          <div className="rounded-[34px] border border-white/60 bg-white/35 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur-sm">
            <div className="rounded-[30px] bg-white/25 p-1">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
