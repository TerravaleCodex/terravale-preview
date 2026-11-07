create or replace function public.terravale_dm_grant_proficiency_choice(
 target_character uuid,proficiency_kind text,choice_pool text default 'any',
 number_of_choices integer default 1,purpose text default ''
) returns jsonb language plpgsql security definer set search_path=''
as $grant$
declare caller uuid:=(select auth.uid());ch public.characters%rowtype;new_choice_id uuid;
begin
 if caller is null or not exists(select 1 from auth.identities where user_id=caller and provider='discord')
 then raise exception 'Verified Discord required' using errcode='28000';end if;
 select * into ch from public.characters where characters.id=target_character;
 if ch.id is null or not authz.is_dm(ch.campaign_id) or ch.owner_id is null then
  raise exception 'Only campaign DM can grant a real player additional choices' using errcode='42501';end if;
 if proficiency_kind not in('tool','language') or choice_pool not in('any','artisan','instrument','game','artisan-instrument')
  or number_of_choices not between 1 and 5 then
  raise exception 'Invalid bonus choice specification' using errcode='22023';end if;
 if proficiency_kind='language' and choice_pool<>'any' then
  raise exception 'Language choices use the language list' using errcode='22023';end if;
 if (select count(*) from public.terravale_proficiency_bonus_choices
   where character_id=ch.id and status='pending')>=12 then
  raise exception 'Resolve outstanding choices before granting more' using errcode='22023';end if;
 insert into public.terravale_proficiency_bonus_choices(character_id,recipient_user_id,
  created_by,kind,choice_pool,choice_count,note)
 values(ch.id,ch.owner_id,caller,proficiency_kind,choice_pool,number_of_choices,left(purpose,240))
 returning id into new_choice_id;
 return jsonb_build_object('created',true,'id',new_choice_id);
end;
$grant$;
