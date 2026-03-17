import Link from "next/link";
import { BarChart3, ClipboardList, Layers3, ListFilter, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import { getViewerContext } from "@/lib/data/queries";
import { Button } from "@/components/ui/button";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/needs", label: "Needs", icon: ClipboardList },
  { href: "/players", label: "Players", icon: ListFilter },
  { href: "/shortlist", label: "Shortlist", icon: Layers3 }
];

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { profile, team } = await getViewerContext();

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
        <aside className="flex w-full flex-col gap-4 rounded-[28px] border bg-white/90 p-4 shadow-panel backdrop-blur lg:w-72">
          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20">
                <ShieldCheck className="h-6 w-6 text-cyan-300" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Ops Suite</p>
                <h1 className="text-lg font-semibold">{team.name}</h1>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-medium">{profile.full_name}</p>
              <p className="text-sm text-slate-300">{profile.role}</p>
            </div>
          </div>

          <nav className="grid gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border bg-slate-50 p-4">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <UsersRound className="h-4 w-4" />
              Keyboard-first review flow enabled
            </div>
            <Button asChild className="mt-4 w-full justify-between">
              <Link href="/login">
                Log out
                <LogOut className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
