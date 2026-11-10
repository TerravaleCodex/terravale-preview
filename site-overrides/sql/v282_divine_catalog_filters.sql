-- V2.82 private, server-side facets for the full 534-entry canonical catalogue.
-- Avoid client-side filtering of a 20-row page (which produces wrong totals).
create or replace function public.terravale_divine_dm_archive_search_v282(
 target_campaign uuid,target_character uuid,
 filter_family text default null,filter_patron text default null,
 filter_tier integer default null,filter_slot text default null,
 filter_availability text default null,filter_uses text default null,
 needle text default null,sort_by text default 'patron',
 page_size integer default 24,page_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path=''
as $v282_search$
declare actor uuid:=(select auth.uid());
 c public.characters%rowtype;value jsonb;
begin
 select * into c from public.characters where id=target_character;
 if actor is null or not exists(select 1 from auth.identities
 where user_id=actor and provider='discord') or not authz.is_dm(target_campaign)
 or c.id is null or c.campaign_id<>target_campaign
 then raise exception 'Verified campaign DM and selected character required'
 using errcode='42501';end if;
 if page_size not between 1 and 60 or page_offset not between 0 and 5000
 or char_length(coalesce(needle,''))>150
 or filter_availability is not null and filter_availability not in('any','held','threshold','locked','formal')
 or sort_by not in('patron','name','tier_up','tier_down')
 or filter_tier is not null and filter_tier not between 0 and 5
 then raise exception 'Invalid catalogue filter or pagination' using errcode='22023';end if;
 with selected as (
  select e.*, coalesce(a.id is not null,false) is_held,
   case
    when a.id is not null then 'held'
    when e.kind in('tier_zero','nyrha_offer') then 'formal'
    when e.kind in('minor_grace','minor_intercession') then 'threshold'
    when e.kind like 'nyrha_%' then
     case when exists(
      select 1 from public.terravale_divine_canon_offers o
       where o.character_id=c.id and o.entry_id=e.id
       and o.status in('accepted','fulfilled')) then 'threshold'
       else 'formal' end
    when e.kind in('divine','concordant') and e.required_favour is not null
      and e.tier between 1 and 5
      and coalesce(f.score,0)>=e.required_favour
      and (e.kind<>'concordant' or e.required_favour_second is not null
       and coalesce(g.score,0)>=e.required_favour_second) then 'threshold'
    else 'locked'
   end as availability
  from public.terravale_divine_archive_entries e
  left join public.terravale_divine_canon_awards a on a.entry_id=e.id
   and a.character_id=c.id and a.status in('active','dormant')
  left join public.terravale_divine_patrons p on p.campaign_id=c.campaign_id
   and lower(p.key_name)=lower(e.patron)
  left join public.terravale_divine_favour f on f.character_id=c.id and f.patron_id=p.id
  left join public.terravale_divine_patrons q on q.campaign_id=c.campaign_id
   and lower(q.key_name)=lower(coalesce(e.other_patron,''))
  left join public.terravale_divine_favour g on g.character_id=c.id and g.patron_id=q.id
  where e.campaign_id=target_campaign
    and (nullif(filter_family,'') is null or e.kind=filter_family)
    and (nullif(filter_patron,'') is null or lower(e.patron)=lower(filter_patron)
     or lower(coalesce(e.other_patron,''))=lower(filter_patron))
    and (filter_tier is null or coalesce(e.tier,-1)=filter_tier)
    and (nullif(filter_slot,'') is null or lower(coalesce(e.slot,''))=lower(filter_slot))
    and (nullif(filter_uses,'') is null or filter_uses='any'
      or (filter_uses='limited' and (
         coalesce(e.uses_text,'')<>'' or e.source_excerpt ~* '(once|twice|per rest|per session|charges?|uses? equal)'))
      or (filter_uses='unlimited' and
       coalesce(e.uses_text,'')='' and e.source_excerpt !~* '(once|twice|per rest|per session|charges?|uses? equal)'))
    and (nullif(needle,'') is null or e.name ilike '%'||needle||'%'
      or e.patron ilike '%'||needle||'%'
      or e.source_heading ilike '%'||needle||'%'
      or e.source_excerpt ilike '%'||needle||'%')
 ), filtered as (
  select * from selected
   where coalesce(filter_availability,'any')='any'
      or availability=filter_availability
 )
 select jsonb_build_object(
  'total',(select count(*) from filtered),
  'entries',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',r.id,'kind',r.kind,'name',r.name,'patron',r.patron,
    'other_patron',r.other_patron,'tier',r.tier,
    'slot',r.slot,'activation',r.activation,'uses_text',r.uses_text,
    'required_favour',r.required_favour,'required_favour_second',r.required_favour_second,
    'source_path',r.source_path,'review_status',r.review_status,
    'availability',r.availability,'held',r.is_held
   ) order by r.sorting)
   from (select f.*,row_number() over(
    order by case when sort_by='name' then lower(f.name) end,
      case when sort_by='tier_up' then f.tier end asc nulls last,
      case when sort_by='tier_down' then f.tier end desc nulls last,
      lower(f.patron),coalesce(f.tier,-1),lower(f.name)
   ) sorting
   from filtered f order by sorting limit page_size offset page_offset) r
  ),'[]'::jsonb),
  'patrons',coalesce((
   select jsonb_agg(name order by name) from (
    select distinct e.patron as name from public.terravale_divine_archive_entries e
    where e.campaign_id=target_campaign and e.patron is not null) x
  ),'[]'::jsonb)
 ) into value;
 return value;
end $v282_search$;
revoke all on function public.terravale_divine_dm_archive_search_v282(
 uuid,uuid,text,text,integer,text,text,text,text,text,integer,integer)
 from public,anon,authenticated;
grant execute on function public.terravale_divine_dm_archive_search_v282(
 uuid,uuid,text,text,integer,text,text,text,text,text,integer,integer)
 to authenticated;
