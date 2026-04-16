-- RLS for player_pff_grades
-- Run in Supabase SQL editor if PFF data is not appearing in the app.

alter table public.player_pff_grades enable row level security;

create policy "Authenticated read player_pff_grades"
  on public.player_pff_grades
  for select
  to authenticated
  using (true);

create policy "Authenticated manage player_pff_grades"
  on public.player_pff_grades
  for all
  to authenticated
  using (true)
  with check (true);
