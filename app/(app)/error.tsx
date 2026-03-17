"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-[28px] border bg-white p-8 shadow-panel">
      <p className="text-sm uppercase tracking-[0.3em] text-rose-500">Error</p>
      <h2 className="mt-2 text-2xl font-semibold">Something broke in the workflow.</h2>
      <p className="mt-3 max-w-xl text-sm text-slate-600">{error.message}</p>
      <Button className="mt-6" onClick={reset}>
        Retry
      </Button>
    </div>
  );
}
