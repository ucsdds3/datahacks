-- A private bucket for the wallet passes send-wallet-passes makes, so the "Add
-- to Apple Wallet" button in the pass email can be a signed link straight to
-- the .pkpass (Safari on an iPhone opens the native Add to Wallet sheet) rather
-- than WalletWallet's web page.
--
-- Files are <event_id>/<random uuid>.pkpass. Only the service role (the edge
-- function) uploads and signs links; there are deliberately no policies on
-- storage.objects for this bucket, so nobody reads or lists it directly. Each
-- person can only open their own pass through the signed link in their email.
-- Additive: no existing bucket, file or policy changes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wallet-passes', 'wallet-passes', false, 1048576, array['application/vnd.apple.pkpass'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nothing may open the bucket up, such as a policy someone added in the dashboard.
do $$
declare
  leftover text;
begin
  select string_agg(format('%s (%s)', policyname, cmd), ', ') into leftover
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and (coalesce(qual, '') || coalesce(with_check, '')) like '%wallet-passes%';
  if leftover is not null then
    raise exception 'The wallet-passes bucket should have no policies, but has: %', leftover;
  end if;
end $$;
