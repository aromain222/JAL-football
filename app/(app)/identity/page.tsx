import Link from "next/link";
import { ExternalLink, Link2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertPlayerIdentityLinkAction } from "@/app/actions";

export default async function IdentityQueuePage() {
  const supabase = createSupabaseServerClient();
  const [{ data: players }, { data: sourceAccounts, error: sourceAccountsError }] = await Promise.all([
    supabase.from("players").select("id, first_name, last_name, position, previous_school, player_identity_links(*)").not("previous_school", "is", null).order("last_name"),
    supabase.from("x_source_accounts").select("id, handle, display_name, category, priority, notes, active").eq("active", true).order("priority", { ascending: true })
  ]);
  const rows = (players ?? []).map((p: any) => { const link = Array.isArray(p.player_identity_links) ? p.player_identity_links[0] : p.player_identity_links; return { ...p, link }; });
  const needsReview = rows.filter((r) => !r.link?.espn_url && !r.link?.roster_url);
  const resolved = rows.filter((r) => r.link?.espn_url || r.link?.roster_url);

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between border-b border-[#e4e8e5] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Identity</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">Connect ESPN and roster links for stat enrichment workflows</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[12px] font-semibold text-amber-800">{needsReview.length} need review</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[12px] font-semibold text-emerald-800">{resolved.length} resolved</span>
        </div>
      </div>

      <section className="rounded-2xl border border-[#e4e8e5] bg-white">
        <div className="border-b border-[#e4e8e5] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-[#111827]">Tracked X source accounts</h2>
        </div>
        <div className="p-5">
          {sourceAccountsError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">
              X source accounts are not ready yet. Run <code className="rounded bg-white px-1">supabase/x_source_accounts.sql</code> in Supabase SQL Editor, then <code className="rounded bg-white px-1">npm run seed:x:sources</code>.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(sourceAccounts ?? []).map((account: any) => (
                <div key={account.id} className="rounded-xl border border-[#e4e8e5] bg-[#f8f9fa] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-[#111827]">{account.display_name}</p>
                      <p className="text-[12px] text-[#15542a]">@{account.handle}</p>
                    </div>
                    <Badge variant="default">{account.category}</Badge>
                  </div>
                  {account.notes && <p className="mt-2 text-[12px] text-[#4b5563]">{account.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-[14px] font-semibold text-[#111827]">Manual review queue</h2>
          <p className="mt-0.5 text-[12px] text-[#9ca3af]">Paste the correct ESPN player URL or official roster profile to enable stat enrichment.</p>
        </div>
        <div className="grid gap-3">
          {needsReview.length ? needsReview.slice(0, 200).map((p: any) => (
            <div key={p.id} className="rounded-2xl border border-[#e4e8e5] bg-white p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <Link href={`/players/${p.id}`} className="text-[14px] font-semibold text-[#111827] hover:underline">{p.first_name} {p.last_name}</Link>
                  <p className="mt-0.5 text-[12px] text-[#4b5563]">{p.position} · prev: {p.previous_school}</p>
                </div>
                <Badge variant="warning" className="flex shrink-0 items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" />needs review</Badge>
              </div>
              <form action={async (formData) => { "use server"; await upsertPlayerIdntityLinkAction({ playerId: p.id, espnUrl: String(formData.get("espnUrl") ?? ""), rosterUrl: String(formData.get("rosterUrl") ?? "") }); }} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div className="grid gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">ESPN URL</label>
                  <input name="espnUrl" className="h-9 rounded-xl border border-[#e4e8e5] px-3 text-[13px] focus:border-[#15542a] focus:outline-none" placeholder="https://www.espn.com/college-football/player/_/id/..." />
                </div>
                <div className="grid gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Roster URL</label>
                  <input name="rosterUrl" className="h-9 rounded-xl border border-[#e4e8e5] px-3 text-[13px] focus:border-[#15542a] focus:outline-none" placeholder="Official team roster profile URL" />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="h-9 rounded-xl bg-[#15542a] px-4 text-[13px] font-medium text-white hover:bg-[#1a6934]">Save</button>
                </div>
              </form>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/players/${p.id}`} className="flex items-center gap-1.5 rounded-xl border border-[#e4e8e5] px-2.5 py-1.5 text-[12px] text-[#4b5563] hover:bg-[#f1f5f2]"><Link2 className="h-3.5 w-3.5" />Open player</Link>
                {p.link?.espn_url && <a href={p.link.espn_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-[#e4e8e5] px-2.5 py-1.5 text-[12px] text-[#4b5563] hover:bg-[#f1f5f2]"><ExternalLink className="h-3.5 w-3.5" />ESPN</a>}
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-[#e4e8e5] p-8 text-center text-[13px] text-[#9ca3af]">No players currently need manual review.</div>
          )}
        </div>
      </section>
    </div>
  );
}
