import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[32px] bg-slate-950 bg-field p-8 text-white shadow-panel lg:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">Transfer Ops</p>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold tracking-tight">
            Recruit the portal with a faster internal board.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            Build position needs, sort players by fit, run swipe review, and move top targets into the right staff stage.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-3xl font-semibold">4.8x</div>
              <p className="mt-2 text-sm text-slate-300">Faster first-pass triage with keyboard review</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-3xl font-semibold">92</div>
              <p className="mt-2 text-sm text-slate-300">Avg. fit score surfaced on top board candidates</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-3xl font-semibold">5</div>
              <p className="mt-2 text-sm text-slate-300">Shortlist stages from position coach to commit watch</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
