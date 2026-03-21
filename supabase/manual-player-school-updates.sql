-- Manual cleanup for players missing previous/current school context.
-- Source: user-provided corrections on 2026-03-20.
-- Run in Supabase SQL Editor.

update public.players
set
  current_school = 'Western Kentucky',
  previous_school = 'Western Kentucky',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: currently at Western Kentucky.')
where first_name = 'Qua''Vez' and last_name = 'Humphreys';

update public.players
set
  current_school = 'Transfer Portal',
  previous_school = 'Arkansas',
  status = 'Portal',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: still in portal, previous school Arkansas.')
where first_name = 'Quentavius' and last_name = 'Scandrett';

update public.players
set
  current_school = 'UNC',
  previous_school = 'UNC',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: at UNC.')
where first_name = 'Jakiah' and last_name = 'Leftwich';

update public.players
set
  current_school = 'Colorado State',
  previous_school = 'Colorado State',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: at Colorado State.')
where first_name = 'Jaden' and last_name = 'Landrum';

update public.players
set
  current_school = 'Duke',
  previous_school = 'Duke',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: at Duke.')
where first_name = 'Matt' and last_name = 'Smith';

update public.players
set
  current_school = 'Ball State',
  previous_school = 'Ball State',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: at Ball State.')
where first_name = 'Sam' and last_name = 'Feeney';

update public.players
set
  current_school = 'Florida State',
  previous_school = 'Florida State',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: at Florida State. User note: 605 squat.')
where first_name = 'Grant' and last_name = 'Fielder';

update public.players
set
  current_school = 'Transfer Portal',
  previous_school = 'Towson University',
  status = 'Portal',
  notes = concat_ws(
    E'\n',
    notes,
    'Manual update 2026-03-20: entering portal from Towson University.',
    'User-provided 2025 line: 21 tackles, 1 INT, 5 PBUs, 1 FF, 1 FR.'
  )
where first_name = 'Zakaa' and last_name = 'Brown';

update public.players
set
  current_school = 'Penn State',
  previous_school = 'Penn State',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: at Penn State, out of portal.')
where first_name = 'Hunter' and last_name = 'Albright';

update public.players
set
  current_school = 'Towson',
  previous_school = 'Towson',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: committed to Towson.')
where first_name = 'Aidan' and last_name = 'Johnson';

update public.players
set
  current_school = 'Alabama',
  previous_school = 'Alabama',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: PWO at Alabama.')
where first_name = 'Jaxon' and last_name = 'Shuttlesworth';

update public.players
set
  current_school = 'UNC',
  previous_school = 'UNC',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: at UNC.')
where first_name = 'Mali' and last_name = 'Hamrick';

update public.players
set
  current_school = 'Transfer Portal',
  previous_school = 'Kentucky',
  status = 'Portal',
  notes = concat_ws(
    E'\n',
    notes,
    'Manual update 2026-03-20 from X bio: Portal RB | 5’11 210lb | 3.2 GPA | 20.2 mph | University of Memphis/University of Kentucky transfer | multiple D1 interest | 2 years of eligibility.'
  )
where first_name = 'Mario' and last_name = 'Robinson';

update public.players
set
  current_school = 'Stony Brook',
  previous_school = 'Stony Brook',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: committed to Stony Brook.')
where first_name = 'Aidan' and last_name = 'Leffler';

update public.players
set
  current_school = 'Out of eligibility',
  previous_school = coalesce(previous_school, 'Unknown'),
  status = 'withdrawn',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: out of eligibility.')
where first_name = 'Chase' and last_name = 'Alexander';

update public.players
set
  current_school = 'Temple',
  previous_school = 'Temple',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: currently at Temple.')
where first_name = 'Patrick' and last_name = 'Keller';

update public.players
set
  current_school = 'Towson',
  previous_school = 'Towson',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: committed to Towson.')
where first_name = 'Weston' and last_name = 'Woodard';

update public.players
set
  current_school = 'UMass',
  previous_school = 'UMass',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: committed to UMass.')
where first_name = 'Nick' and last_name = 'Dalessandro';

update public.players
set
  current_school = 'Liberty',
  previous_school = 'Liberty',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: was at Liberty.')
where first_name = 'Bryson' and last_name = 'Jennings';

update public.players
set
  current_school = 'Syracuse',
  previous_school = 'Syracuse',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: was at Syracuse.')
where first_name = 'Zeed' and last_name = 'Haynes';

update public.players
set
  current_school = 'Middle Tennessee State',
  previous_school = 'Middle Tennessee State',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: at Middle Tennessee State.')
where first_name = 'Markel' and last_name = 'James';

update public.players
set
  current_school = 'Merrimack',
  previous_school = 'Merrimack',
  status = 'committed',
  notes = concat_ws(E'\n', notes, 'Manual update 2026-03-20: signed by Merrimack.')
where first_name = 'Guytano' and last_name = 'Bartolomeo';

-- User did not provide updated school context yet for:
-- Trace Meadows
-- Roger Jones

-- Optional: persist Zakaa Brown season stats into player_stats if no 2025 row exists.
insert into public.player_stats (
  player_id,
  season,
  games_played,
  starts,
  tackles,
  interceptions,
  passes_defended,
  forced_fumbles,
  source
)
select
  p.id,
  2025,
  null,
  null,
  21,
  1,
  5,
  1,
  'manual-user-update'
from public.players p
where p.first_name = 'Zakaa'
  and p.last_name = 'Brown'
on conflict (player_id, season) do update
set
  tackles = excluded.tackles,
  interceptions = excluded.interceptions,
  passes_defended = excluded.passes_defended,
  forced_fumbles = excluded.forced_fumbles,
  source = excluded.source;

