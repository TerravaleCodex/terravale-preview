-- Terravale V2.49: concise human-readable campaign invitations.
-- 6 cryptographically random characters from a 32-symbol alphabet = 30 bits.
-- Existing legacy TV-<32 hex> codes remain valid until expiration/revocation.
-- TV-DEMO is handled by the separate demo join RPC in the application.

create or replace function public.create_campaign_join_code(
 target_campaign uuid, days_valid integer default 7, allowed_uses integer default 1
) returns text
language plpgsql security definer set search_path=''
as $function$
declare
 alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
 entropy bytea;
 code text;
 i integer;
 attempt integer;
begin
 if (select auth.uid()) is null or not authz.is_dm(target_campaign)
   then raise exception 'Campaign DM required'; end if;
 if days_valid not between 1 and 30 or allowed_uses not between 1 and 100
   then raise exception 'Invalid invite limits'; end if;

 for attempt in 1..12 loop
   entropy := extensions.gen_random_bytes(6);
   code := 'TV-';
   for i in 0..5 loop
     -- Exactly 32 symbols; each byte maps without modulo bias.
     code := code || substr(alphabet, 1 + (get_byte(entropy,i) % 32), 1);
   end loop;
   begin
     insert into public.campaign_invites
       (campaign_id,code_hash,created_by,expires_at,max_uses)
     values
       (target_campaign, encode(sha256(convert_to(code,'UTF8')),'hex'),
        (select auth.uid()), now()+make_interval(days=>days_valid),allowed_uses);
     return code;
   exception when unique_violation then
     -- Avoid reusing even a revoked or expired code.
     continue;
   end;
 end loop;
 raise exception 'Unable to issue a unique campaign code; retry';
end;
$function$;

create or replace function public.join_campaign_by_code(given_code text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare
 chosen public.campaign_invites%rowtype;
 already_member boolean;
 cleaned text := trim(upper(coalesce(given_code,'')));
begin
 if (select auth.uid()) is null then raise exception 'Sign in before joining'; end if;
 if cleaned !~ '^TV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$'
    and cleaned !~ '^TV-[A-F0-9]{32}$' then
   raise exception 'Invalid campaign join code format';
 end if;
 select * into chosen from public.campaign_invites
   where code_hash=encode(sha256(convert_to(cleaned,'UTF8')),'hex') for update;
 if not found or not chosen.active or chosen.expires_at<=now()
    or chosen.use_count>=chosen.max_uses then
   raise exception 'Code expired, revoked or already used';
 end if;
 already_member:=authz.is_member(chosen.campaign_id);
 if already_member then return chosen.campaign_id; end if;
 insert into public.campaign_members(campaign_id,user_id,role)
   values(chosen.campaign_id,(select auth.uid()),'player') on conflict do nothing;
 update public.campaign_invites set use_count=use_count+1 where id=chosen.id;
 return chosen.campaign_id;
end;
$function$;

-- Preserve current authenticated RPC grants; do not allow anonymous use.
revoke all on function public.create_campaign_join_code(uuid,integer,integer) from public,anon;
revoke all on function public.join_campaign_by_code(text) from public,anon;
grant execute on function public.create_campaign_join_code(uuid,integer,integer) to authenticated;
grant execute on function public.join_campaign_by_code(text) to authenticated;
