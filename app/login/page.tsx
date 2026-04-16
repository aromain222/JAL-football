import { Building2, ShieldCheck, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getViewerContext, getWorkspaceMembers } from "@/lib/data/queries";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { normalizeWorkspaceRole } from "@/lib/workspace-role";

export default async function LoginPage() {
  if (hasSupabaseEnv()) {
    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  }

  const [{ team }, members] = await Promise.all([getViewerContext(), getWorkspaceMembers()]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(205,170,95,0.16),_transparent_34%),linear-gradient(180deg,_#f6f4ee_0%,_#eef2eb_48%,_#e4ece4_100%)] px-4 py-6 lg:px-6 lg:py-8">
      <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="shell-panel relative overflow-hidden rounded-[34px] px-6 py-7 lg:px-8 lg:py-9">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(205,170,95,0.08),transparent_22%),radial-gradient(circle_at_top_right,rgba(205,170,95,0.14),transparent_36%)]" />
          <div className="relative">
            <div className="scouting-shell-badge inline-flex w-auto items-center gap-3 px-4 py-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/10">
                <ShieldCheck className="h-6 w-6 text-[#f0d69a]" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-[#f3dfaf]/80">Football Ops Access</p>
                <p className="text-lg font-semibold text-white">Calm team login</p>
              </div>
            </div>

            <div className="mt-8 max-w-[34rem]">
              <p className="text-[11px] uppercase tracking-[0.34em] text-[#f3dfaf]/78">Organization</p>
              <h1 className="mt-3 text-[clamp(2.8rem,6vw,4.9rem)] font-semibold uppercase leading-[0.92] tracking-[0.06em] text-[#f7f0dc]">
                {team.name}
              </h1>
              <p className="mt-5 max-w-[31rem] text-base leading-7 text-[#d7e0d3]/78">
                Enter an email, create a password, and open the recruiting workspace. Staff can share one board,
                keep roles visible, and move through portal eval without a heavy setup flow.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-white/12 bg-white/8 p-5">
                <div className="flex items-center gap-3 text-[#f5e4b5]">
                  <Building2 className="h-5 w-5" />
                  <span className="text-[11px] uppercase tracking-[0.3em]">Board Access</span>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">{team.name}</p>
                <p className="mt-3 text-sm leading-6 text-[#d7e0d3]/72">
                  Shared recruiting board, shortlist workflow, and player search live under one organization shell.
                </p>
              </div>
              <div className="rounded-[28px] border border-white/12 bg-white/8 p-5">
                <div className="flex items-center gap-3 text-[#f5e4b5]">
                  <UsersRound className="h-5 w-5" />
                  <span className="text-[11px] uppercase tracking-[0.3em]">Staff View</span>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">{members.length}</p>
                <p className="mt-3 text-sm leading-6 text-[#d7e0d3]/72">
                  Coaches and staff attached to this board appear together so everyone knows who is operating inside the workspace.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-[30px] border border-white/12 bg-white/8 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[#f3dfaf]/78">Staff Roster</p>
                  <p className="mt-2 text-sm text-[#d7e0d3]/72">Visible inside the organization workspace.</p>
                </div>
                <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs uppercase tracking-[0.24em] text-[#f5e4b5]">
                  {team.conference}
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {members.map((member) => {
                  const displayRole = normalizeWorkspaceRole(member.role) ?? member.role;
                  const initials = member.full_name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-black/10 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-[#101d15] text-sm font-semibold text-[#f7e8bd]">
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{member.full_name}</p>
                          <p className="text-xs uppercase tracking-[0.24em] text-[#d7e0d3]/58">{displayRole}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-[540px]">
            <LoginForm />
          </div>
        </section>
      </div>
    </div>
  );
}
