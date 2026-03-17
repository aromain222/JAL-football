"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/lib/database.types";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "demo-anon-key"
  );
}
