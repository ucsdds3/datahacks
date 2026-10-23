-- Every application belongs to one event. None in production lacked one
-- (checked 2026-10-23: 0 of 24), and the forms always set it; this makes it a
-- rule so nothing can be saved outside an event (see docs/event-isolation.md).
alter table public.applications alter column event_id set not null;
