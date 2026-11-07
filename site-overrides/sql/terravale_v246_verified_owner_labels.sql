-- Return VERIFIED Discord names for characters that the current viewer may read.
create or replace function public.terravale_character_owner_labels()
returns table(character_id uuid, discord_username text, tvuid text)
language sql stable security definer set search_path=''
as $$
  select ch.id,p.discord_username,p.tvuid
  from public.characters ch
  join public.terravale_profiles p on p.user_id=ch.owner_id
  where (select auth.uid()) is not null
  and authz.is_member(ch.campaign_id)
  and (
    ch.owner_id=(select auth.uid())
    or authz.is_dm(ch.campaign_id)
    or (ch.status='approved' and ch.sheet_visible_to_party)
  );
$$;
revoke all on function public.terravale_character_owner_labels() from public,anon;
grant execute on function public.terravale_character_owner_labels() to authenticated;
