-- DataHacks 2026 had no dates. The check-in app picks the event with the latest
-- start, and Postgres sorts an empty start first, so it was checking everyone in
-- to DH26 instead of the current event. April 18–19, 2026 (Pacific).
update public.events
set starts_at = '2026-04-18 09:00-07', ends_at = '2026-04-19 21:00-07'
where code = 'DH26' and starts_at is null;
