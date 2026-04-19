"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) { setError(signUpError.message); setLoading(false); return; }
      if (!data.session) {
        setNotice("Account created. Check your email to verify, then sign in.");
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError(signInError.message); setLoading(false); return; }
    }

    if (mode === "signup") setNotice("Account ready. Opening your workspace.");
    router.push("/dashboard");
    router.refresh();
  }

  const title = mode === "signin" ? "Access Workspace" : "Create Workspace Login";
  const description =
    mode === "signin"
      ? "Use your email and password to review players, manage needs, and move the shortlist."
      : "Create a coach login with just your email and password. The app will attach you to the current organization.";

  return (
    <div className="w-full rounded-2xl border border-[#e4e8e5] bg-white p-6 shadow-sm">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#dcf0e3]">
        <Shield className="h-6 w-6 text-[#15542a]" />
      </div>

      <div className="mb-5 inline-flex rounded-xl border border-[#e4e8e5] bg-[#f1f5f2] p-1">
        <button
          type="button"
          className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors ${
            mode === "signin" ? "bg-white text-[#111827] shadow-sm" : "text-[#9ca3af]"
          }`}
          onClick={() => { setMode("signin"); setError(null); setNotice(null); }}
        >
          Log in
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors ${
            mode === "signup" ? "bg-white text-[#111827] shadow-sm" : "text-[#9ca3af]"
          }`}
          onClick={() => { setMode("signup"); setError(null); setNotice(null); }}
        >
          Create account
        </button>
      </div>

      <h2 className="text-[20px] font-bold text-[#111827]">{title}</h2>
      <p className="mt-1 mb-5 text-[13px] leading-5 text-[#4b5563]">{description}</p>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-1.5">
          <label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Email</label>
          <input
            id="email" name="email" type="email" placeholder="coach@redvalleyfb.com" required
            className="h-10 rounded-xl border border-[#e4e8e5] px-3 text-[13px] text-[#111827] placeholder:text-[#9ca3af] focus:border-[#15542a] focus:outline-none"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Password</label>
          <input id="password" name="password" type="password" required
            className="h-10 rounded-xl border border-[#e4e8e5] px-3 text-[13px] text-[#111827] focus:border-[#15542a] focus:outline-none"
          />
        </div>
        {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
        {notice ? <p className="text-[13px] text-[#15542a]">{notice}</p> : null}
        <button
          type="submit" disabled={loading}
          className="flex items-center justify-between rounded-xl bg-[#15542a] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#1a6934] disabled:opacity-60"
        >
          <span>{mode === "signin" ? "Open workspace" : "Create login"}</span>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        </button>
        <p className="text-[12px] text-[#9ca3af]">
          Email and password only. Organization access is attached automatically.
        </p>
      </form>
    </div>
  );
}
