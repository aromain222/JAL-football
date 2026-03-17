insert into public.teams (id, name, conference)
values ('8d3b3d8f-0f82-4717-9db7-7c8804dafd11', 'JAL Football', 'Big 12')
on conflict (id) do update
set name = excluded.name,
    conference = excluded.conference;

insert into public.players (
  id, first_name, last_name, position, transfer_year, current_school, previous_school, hometown,
  class_year, eligibility_remaining, stars, academic_status, status, film_url, contact_window, notes
)
values
  ('f90320ae-6054-4b15-84a1-7fd4dbe6f94e', 'Malik', 'Denson', 'WR', 2026, 'Boise State', 'UNLV', 'Houston, TX', 'JR', 2, 3, 'Eligible', 'Portal', 'https://hudl.com/video/3/1234567/6543210', 'Spring', 'Explosive slot with punt return value'),
  ('0993c985-cc22-480c-89f6-f647d8f7e3ee', 'Jalen', 'McCoy', 'EDGE', 2026, 'UTSA', 'Arkansas State', 'Mobile, AL', 'SR', 1, 3, 'Eligible', 'Portal', 'https://www.youtube.com/watch?v=edge-player', 'Open', 'Long-body pass rusher who flashes speed-to-power'),
  ('6180b4a9-1aca-41f2-8fb4-9cbf52d05501', 'Trent', 'Holloway', 'OL', 2026, 'North Texas', null, 'Tulsa, OK', 'JR', 2, 2, 'Eligible', 'Portal', 'https://hudl.com/video/3/222222/111111', 'Spring', 'Swing tackle with 900+ live snaps'),
  ('de9d6b28-fbc3-4ed0-9db5-c00085fdfb16', 'Kobe', 'Sanders', 'CB', 2026, 'Tulane', 'Mississippi State', 'New Orleans, LA', 'JR', 2, 4, 'Eligible', 'Portal', 'https://www.youtube.com/watch?v=cb-player', 'Open', 'Press-man profile with SEC background')
on conflict (id) do update
set first_name = excluded.first_name,
    last_name = excluded.last_name,
    position = excluded.position,
    current_school = excluded.current_school,
    notes = excluded.notes;

insert into public.player_measurements (
  player_id, height_in, weight_lbs, forty_time, shuttle_time, vertical_jump, wing_span_in, verified_at
)
values
  ('f90320ae-6054-4b15-84a1-7fd4dbe6f94e', 72, 188, 4.42, 4.10, 37.0, 74.0, '2026-01-14'),
  ('0993c985-cc22-480c-89f6-f647d8f7e3ee', 77, 247, 4.67, 4.33, 33.0, 81.0, '2026-01-08'),
  ('6180b4a9-1aca-41f2-8fb4-9cbf52d05501', 78, 307, 5.18, 4.71, 27.0, 82.0, '2026-01-11'),
  ('de9d6b28-fbc3-4ed0-9db5-c00085fdfb16', 73, 194, 4.48, 4.08, 38.0, 76.0, '2026-01-05')
on conflict (player_id) do update
set height_in = excluded.height_in,
    weight_lbs = excluded.weight_lbs,
    forty_time = excluded.forty_time,
    verified_at = excluded.verified_at;

insert into public.player_stats (
  player_id, season, games_played, starts, offensive_snaps, defensive_snaps, special_teams_snaps,
  passing_yards, rushing_yards, receiving_yards, total_touchdowns, tackles, sacks, interceptions, passes_defended
)
values
  ('f90320ae-6054-4b15-84a1-7fd4dbe6f94e', 2025, 12, 10, 512, 0, 86, 0, 94, 842, 9, 0, 0, 0, 0),
  ('0993c985-cc22-480c-89f6-f647d8f7e3ee', 2025, 13, 11, 0, 598, 35, 0, 0, 0, 0, 44, 8.0, 0, 4),
  ('6180b4a9-1aca-41f2-8fb4-9cbf52d05501', 2025, 12, 12, 781, 0, 44, 0, 0, 0, 0, 0, 0, 0, 0),
  ('de9d6b28-fbc3-4ed0-9db5-c00085fdfb16', 2025, 11, 9, 0, 602, 64, 0, 0, 0, 0, 39, 0, 3, 11)
on conflict (player_id, season) do update
set games_played = excluded.games_played,
    starts = excluded.starts,
    offensive_snaps = excluded.offensive_snaps,
    defensive_snaps = excluded.defensive_snaps;

insert into public.player_tags (player_id, tag)
values
  ('f90320ae-6054-4b15-84a1-7fd4dbe6f94e', 'speed'),
  ('f90320ae-6054-4b15-84a1-7fd4dbe6f94e', 'returner'),
  ('0993c985-cc22-480c-89f6-f647d8f7e3ee', 'length'),
  ('0993c985-cc22-480c-89f6-f647d8f7e3ee', 'pass-rush'),
  ('6180b4a9-1aca-41f2-8fb4-9cbf52d05501', 'multi-position'),
  ('6180b4a9-1aca-41f2-8fb4-9cbf52d05501', 'experience'),
  ('de9d6b28-fbc3-4ed0-9db5-c00085fdfb16', 'man-coverage'),
  ('de9d6b28-fbc3-4ed0-9db5-c00085fdfb16', 'ball-skills')
on conflict (player_id, tag) do nothing;
