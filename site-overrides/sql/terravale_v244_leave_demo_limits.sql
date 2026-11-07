-- V2.44: safe voluntary campaign departure and shared-demo protection.
create or replace function public.terravale_leave_campaign(target_campaign uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare caller uuid := (select auth.uid()); removed_count integer := 0; demo boolean := false;
begin
 if caller is null then raise exception 'Discord login is required' using errcode='28000'; end if;
 if not exists(select 1 from auth.identities i where i.user_id=caller and i.provider='discord')
 then raise exception 'Verified Discord identity required' using errcode='28000'; end if;
 if not exists(select 1 from public.campaigns where id=target_campaign)
 then raise exception 'Campaign not found' using errcode='P0002'; end if;
 if exists(select 1 from public.campaigns where id=target_campaign and owner_id=caller)
 then raise exception 'Campaign owners cannot leave their own campaign; transfer or delete ownership first' using errcode='42501'; end if;
 select exists(select 1 from public.terravale_system_campaigns where campaign_id=target_campaign) into demo;
 delete from public.campaign_members where campaign_id=target_campaign and user_id=caller;
 get diagnostics removed_count = row_count;
 if removed_count<>1 then raise exception 'You are not a member of that campaign' using errcode='42501'; end if;
 return jsonb_build_object('left',true,'campaign_id',target_campaign,'is_demo',demo);
end $$;
revoke all on function public.terravale_leave_campaign(uuid) from public,anon;
grant execute on function public.terravale_leave_campaign(uuid) to authenticated;

create or replace function public.terravale_demo_campaign_id()
returns uuid language sql stable security definer set search_path=''
as $$select campaign_id from public.terravale_system_campaigns where kind='wayfarers-demo' limit 1$$;
revoke all on function public.terravale_demo_campaign_id() from public,anon;
grant execute on function public.terravale_demo_campaign_id() to authenticated;

create or replace function public.terravale_demo_campaign_readonly()
returns trigger language plpgsql security definer set search_path=''
as $$
declare target_campaign uuid;
begin
 if TG_TABLE_NAME='campaigns' then target_campaign:=old.id; else target_campaign:=new.campaign_id; end if;
 if exists(select 1 from public.terravale_system_campaigns where campaign_id=target_campaign)
 then raise exception 'Shared demo campaign cannot be edited, removed, or assigned ordinary invitations' using errcode='42501'; end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists terravale_demo_no_modify on public.campaigns;
create trigger terravale_demo_no_modify before update or delete on public.campaigns
for each row execute function public.terravale_demo_campaign_readonly();
drop trigger if exists terravale_demo_no_invites on public.campaign_invites;
create trigger terravale_demo_no_invites before insert or update on public.campaign_invites
for each row execute function public.terravale_demo_campaign_readonly();

create or replace function public.terravale_demo_character_limits()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.terravale_system_campaigns where campaign_id=new.campaign_id)
 then return new; end if;
 if new.owner_id is null or new.status<>'draft' or coalesce(new.approved_build->>'level','1')<>'1'
 then raise exception 'Demo characters must be player-owned level-one drafts' using errcode='42501'; end if;
 if TG_OP='INSERT' and exists(select 1 from public.characters
    where campaign_id=new.campaign_id and owner_id=new.owner_id)
 then raise exception 'Demo allows one test character per player' using errcode='23514'; end if;
 return new;
end $$;
drop trigger if exists terravale_demo_character_guard on public.characters;
create trigger terravale_demo_character_guard before insert or update on public.characters
for each row execute function public.terravale_demo_character_limits();