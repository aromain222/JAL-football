import Link from "next/link";
import { ExternalLink, Link2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertPlayerIdentityLinkAction } from "@/app/actions";
import { scoutingDisplay } from "@/lib/football-ui";

export default async function IdentityQueuePage() {
  const supabase = createSupabaseServerClient();
  const [{ data: players }, { data: sourceAccounts, error: sourceAccountsError }] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, position, previous_school, player_identity_links(*)")
      .not("previous_school", "is", null)
      .order("last_name"),
    supabase
      .from("x_source_accounts")
      .select("id, handle, display_name, category, priority, notes, active")
      .eq("active", true)
      .order("priority", { ascending: true })
  ]);

  const rows =
    (players ?? []).map((p: any) => {
      const link = Array.isArray(p.player_identity_links) ? p.player_identity_links[0] : p.player_identity_links;
      return { ...p, link };
    }) ?? [];

  const needsReview = rows.filter((r) => !r.link?.espn_url && !r.link?.roster_url);
  const resolved = rows.filter((r) => r.link?.espn_url || r.link?.roster_url);

  return (
    <div className="grid gap-6">
      <section className="scouting-panel relative isolate">
        <div className="field-grid-lines absolute inset-0 opacity-40" />
        <div className="absolute inset-y-0 left-[11%] w-px bg-white/10" />
        <div className="absolute inset-y-0 right-[17%] w-px bg-white/10" />
        <div className="relative grid gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.85fr)] lg:px-8 lg:py-8">
          <div>
            <p className="field-label scouting-kicker">Identity Queue</p>
            <h1 className={`${scoutingDisplay.className} mt-3 text-[3.2rem] uppercase leading-[0.9] tracking-[0.04em] text-[#f5efe0] sm:text-[4.2rem]`}>
              Resolve Player Links
            </h1>
            <p className="scouting-support mt-4 max-w-2xl text-sm leading-6 sm:text-[15px]">
              Connect ESPN and roster identities so player records can feed stat enrichment and monitoring workflows cleanly.
            </p>
          </div>
          <div className="grid gap-3 self-end sm:grid-cols-2 lg:grid-cols-1">
            <div className="scouting-hero-stat">
              <p className="field-label text-[var(--scout-teal)]">Need Review</p>
              <div className={`${scoutingDisplay.className} mt-2 text-[2.8rem] leading-none text-white`}>
                {needsReview.length}
              </div>
              <p className="mt-2 text-sm text-white/70">Players missing ESPN or roster links.</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="scouting-surface">
        <CardHeader>
          <CardTitle>Tracked X source accounts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {sourceAccountsError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              X source accounts are not ready yet. Run <code className="rounded bg-white px-1">supabase/x_source_accounts.sql</code> in Supabase SQL Editor, then{" "}
              <code className="rounded bg-white px-1">npm run seed:x:sources</code>.
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Use these accounts as the first monitoring set for player-level portal notes and spotlight tweets.
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(sourceAccounts ?? []).map((account: any) => (
                  <div key={account.id} className="rounded-2xl border bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{account.display_name}</p>
                      <p className="text-sm text-[#355546]">@{account.handle}</p>
                      </div>
                      <Badge variant="default">{account.category}</Badge>
                    </div>
                    {account.notes ? <p className="mt-3 text-sm text-slate-600">{account.notes}</p> : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="scouting-dark-surface overflow-hidden border-[var(--scout-card-border)] text-white">
        <CardContent className="flex flex-col gap-3 p-7">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--scout-gold-soft)]">Identity Resolution</p>
          <h1 className={`${scoutingDisplay.className} text-[2.6rem] uppercase leading-none tracking-[0.04em]`}>Manual review queue</h1>
          <p className="text-sm text-[#d7e0d3]/75">
            Paste the correct ESPN player URL or official roster profile. Both links feed direct stat backfill scripts for missing-player coverage.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="accent">{needsReview.length} need review</Badge>
            <Badge variant="success">{resolved.length} resolved</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {needsReview.length ? (
          needsReview.slice(0, 200).map((p: any) => (
            <Card key={p.id} className="scouting-surface overflow-hidden">
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    <Link href={`/players/${p.id}`} className="hover:underline">
                      {p.first_name} {p.last_name}
                    </Link>
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-600">
                    {p.position} • prev: {p.previous_school}
                  </p>
                </div>
                <Badge variant="warning" className="flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  needs review
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-3">
                <form
                  action={async (formData) => {
                    "use server";
                    await upsertPlayerIdentityLinkAction({
                      playerId: p.id,
                      espnUrl: String(formData.get("espnUrl") ?? ""),
                      rosterUrl: String(formData.get("rosterUrl") ?? "")
                    });
                  }}
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-slate-500">ESPN URL</label>
                    <input
                      name="espnUrl"
                      className="h-10 rounded-xl border px-3 text-sm"
                      placeholder="https://www.espn.com/college-football/player/_/id/..."
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs font-medium text-slate-500">Roster URL</label>
                    <input
                      name="rosterUrl"
                      className="h-10 rounded-xl border px-3 text-sm"
                      placeholder="Official team roster profile URL"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full sm:w-auto">
                      Save
                    </Button>
                  </div>
                </form>

                <div className="flex flex-wrap gap-2 text-sm">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/players/${p.id}`}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Open player
                    </Link>
                  </Button>
                  {p.link?.espn_url ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={p.link.espn_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        ESPN
                      </a>
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">
                  Saved links can be used by <code className="rounded bg-slate-100 px-1">npm run enrich:stats:espn</code> or{" "}
                  <code className="rounded bg-slate-100 px-1">npm run enrich:stats:roster</code>.
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-slate-600">No players currently need manual review.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
