-- ============================================================================
-- Migration 002: Transfer Portal Data Pipeline Tables
-- Run in Supabase SQL Editor or via supabase db push
-- ============================================================================

-- ── player_portal_events ─────────────────────────────────────────────────────
-- Immutable audit log. One row per detected state change from any source.

CREATE TABLE IF NOT EXISTS public.player_portal_events (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      UUID         NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  sportradar_id  TEXT,
  event_type     TEXT         NOT NULL
                   CHECK (event_type IN ('entered','committed','withdrawn','updated','re_entered')),
  old_status     TEXT,
  new_status     TEXT,
  source         TEXT         NOT NULL DEFAULT 'sportradar'
                   CHECK (source IN ('sportradar','cfbd','manual')),
  raw_payload    JSONB,
  detected_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_events_player
  ON public.player_portal_events(player_id, detected_at DESC);

-- ── enrichment_queue ─────────────────────────────────────────────────────────
-- Work queue. One active entry per player (pending or claimed at a time).
-- Priority 1 = highest urgency, 10 = lowest.

CREATE TABLE IF NOT EXISTS public.enrichment_queue (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID         NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status        TEXT         NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','claimed','done','failed','skipped')),
  priority      INT          NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  attempts      INT          NOT NULL DEFAULT 0,
  max_attempts  INT          NOT NULL DEFAULT 3,
  claimed_at    TIMESTAMPTZ,
  claimed_by    TEXT,
  last_error    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Only one active queue entry (pending or claimed) per player at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrichment_queue_active
  ON public.enrichment_queue(player_id)
  WHERE status IN ('pending','claimed');

-- Poll index: pick by priority then age.
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_poll
  ON public.enrichment_queue(status, priority ASC, created_at ASC)
  WHERE status = 'pending';

-- ── enrichment_runs ──────────────────────────────────────────────────────────
-- Per-step audit log. One row per (player, step, attempt).

CREATE TABLE IF NOT EXISTS public.enrichment_runs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id  UUID         REFERENCES public.enrichment_queue(id) ON DELETE SET NULL,
  player_id       UUID         NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  step            TEXT         NOT NULL
                    CHECK (step IN (
                      'espn_resolve',
                      'espn_stats',
                      'cfbd_stats',
                      'cfbd_school',
                      'pff_scrape'
                    )),
  status          TEXT         NOT NULL
                    CHECK (status IN ('success','failed','skipped','no_data')),
  duration_ms     INT,
  error_message   TEXT,
  result_summary  JSONB,
  ran_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_runs_player_step
  ON public.enrichment_runs(player_id, step, ran_at DESC);

-- ── enrichment_jobs ──────────────────────────────────────────────────────────
-- One row per batch execution of the enrichment worker.

CREATE TABLE IF NOT EXISTS public.enrichment_jobs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_source  TEXT         NOT NULL DEFAULT 'cron'
                    CHECK (trigger_source IN ('cron','threshold','manual','github_actions')),
  status          TEXT         NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','completed','failed')),
  player_ids      UUID[],
  batch_size      INT          NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  summary         JSONB
);

-- ── sync_cursors ─────────────────────────────────────────────────────────────
-- Key/value store for sync state (last run timestamps, cursor tokens).

CREATE TABLE IF NOT EXISTS public.sync_cursors (
  key         TEXT         PRIMARY KEY,
  value       TEXT         NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── players table additions ───────────────────────────────────────────────────
-- Extend existing players table with pipeline-specific columns.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS portal_entered_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS committed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS destination_school  TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_status   TEXT NOT NULL DEFAULT 'unenriched'
    CHECK (enrichment_status IN ('unenriched','partial','complete'));

-- Update status column to allow new states (if it was previously only 'Portal')
-- This assumes status is TEXT; if it's an enum you must ALTER TYPE separately.
-- The existing CHECK constraint (if any) should be dropped and re-added:
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_status_check;

ALTER TABLE public.players
  ADD CONSTRAINT players_status_check
    CHECK (status IN ('Portal','Committed','Withdrawn','Enrolled','Archived'));

-- Index for the most common query pattern: active portal players
CREATE INDEX IF NOT EXISTS idx_players_active_portal
  ON public.players(status, position, eligibility_remaining)
  WHERE status = 'Portal';

-- ── Atomic batch claim function ───────────────────────────────────────────────
-- Uses FOR UPDATE SKIP LOCKED so concurrent workers never claim the same row.
-- Call: SELECT * FROM claim_enrichment_batch(10, 'worker-abc123');

CREATE OR REPLACE FUNCTION public.claim_enrichment_batch(
  p_batch_size  INT,
  p_worker_id   TEXT DEFAULT 'default'
)
RETURNS SETOF public.enrichment_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.enrichment_queue
  SET
    status      = 'claimed',
    claimed_at  = NOW(),
    claimed_by  = p_worker_id,
    attempts    = attempts + 1,
    updated_at  = NOW()
  WHERE id IN (
    SELECT id
    FROM   public.enrichment_queue
    WHERE  status = 'pending'
      AND  attempts < max_attempts
    ORDER BY priority ASC, created_at ASC
    LIMIT  p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- ── Auto-update updated_at on enrichment_queue ────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_enrichment_queue_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrichment_queue_updated_at ON public.enrichment_queue;
CREATE TRIGGER trg_enrichment_queue_updated_at
  BEFORE UPDATE ON public.enrichment_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_enrichment_queue_updated_at();

-- ── RLS: pipeline tables readable by authenticated users ──────────────────────

ALTER TABLE public.player_portal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_queue     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_cursors         ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; anon/authenticated users read-only on monitoring tables.
CREATE POLICY "authenticated read portal_events"
  ON public.player_portal_events FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated read enrichment_queue"
  ON public.enrichment_queue FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated read enrichment_runs"
  ON public.enrichment_runs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated read enrichment_jobs"
  ON public.enrichment_jobs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated read sync_cursors"
  ON public.sync_cursors FOR SELECT
  TO authenticated USING (true);
