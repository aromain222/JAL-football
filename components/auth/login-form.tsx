"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setNotice("Account created. Check your email to verify, then sign in.");
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    }

    if (mode === "signup") {
      setNotice("Account ready. Opening your workspace.");
    }

    router.push("/dashboard");
    router.refresh();
  }

  const title = mode === "signin" ? "Access Workspace" : "Create Workspace Login";
  const description =
    mode === "signin"
      ? "Use your email and password to review players, manage needs, and move the shortlist."
      : "Create a coach login with just your email and password. The app will attach you to the current organization.";

  return (
    <Card className="w-full border-white/70 bg-white/78 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-sm">
      <CardHeader className="space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#11261a] text-[#f0d69a] shadow-inner">
          <Shield className="h-7 w-7" />
        </div>
        <div className="inline-flex rounded-full border border-[#d7dccc] bg-[#edf1e5] p-1 text-sm">
          <button
            type="button"
            className={`rounded-full px-4 py-2 transition ${
              mode === "signin"
                ? "bg-[#183724] text-white shadow-[0_10px_24px_rgba(24,55,36,0.24)]"
                : "text-slate-600"
            }`}
            onClick={() => {
              setMode("signin");
              setError(null);
              setNotice(null);
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 transition ${
              mode === "signup"
                ? "bg-[#183724] text-white shadow-[0_10px_24px_rgba(24,55,36,0.24)]"
                : "text-slate-600"
            }`}
            onClick={() => {
              setMode("signup");
              setError(null);
              setNotice(null);
            }}
          >
            Create account
          </button>
        </div>
        <div>
          <CardTitle className="text-3xl">{title}</CardTitle>
          <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="coach@redvalleyfb.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {notice ? <p className="text-sm text-[#30543d]">{notice}</p> : null}
          <Button type="submit" size="lg" disabled={loading} className="scouting-cta justify-between">
            <span>{mode === "signin" ? "Open workspace" : "Create login"}</span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </Button>
          <p className="text-xs text-slate-500">
            Keep it simple: email and password only. Organization access is attached automatically for this workspace.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
