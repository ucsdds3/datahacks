-- The private wallet-passes bucket (migration *_wallet_passes_bucket.sql).
-- Run with supabase/tests/run.sh. Each check prints PASS or raises FAIL.
\set ON_ERROR_STOP on

do $$
declare b storage.buckets;
begin
  select * into b from storage.buckets where id = 'wallet-passes';
  if b.id is null then raise exception 'FAIL: no wallet-passes bucket'; end if;
  if b.public is distinct from false then raise exception 'FAIL: wallet-passes is public'; end if;
  if b.allowed_mime_types is distinct from array['application/vnd.apple.pkpass'] then
    raise exception 'FAIL: wallet-passes takes %', b.allowed_mime_types;
  end if;
  raise notice 'PASS wallet-passes bucket is private and only takes .pkpass files';
end $$;

-- Nobody but the service role can read it: no policy mentions the bucket.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and (coalesce(qual, '') || coalesce(with_check, '')) like '%wallet-passes%') then
    raise exception 'FAIL: a policy opens wallet-passes';
  end if;
  raise notice 'PASS no storage policy opens wallet-passes';
end $$;

-- Running the migration again changes nothing and keeps the bucket private.
update storage.buckets set public = true where id = 'wallet-passes';
set client_min_messages = warning;
\ir ../migrations/20261101215820_wallet_passes_bucket.sql
set client_min_messages = notice;
do $$
begin
  if (select public from storage.buckets where id = 'wallet-passes') then
    raise exception 'FAIL: re-running the migration left the bucket public';
  end if;
  raise notice 'PASS re-running the migration makes the bucket private again';
end $$;
