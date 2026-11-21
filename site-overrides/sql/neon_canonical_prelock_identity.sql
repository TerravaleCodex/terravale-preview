-- Terravale / Neon migration: fail closed BEFORE canonical divine row locks.
-- Tested on disposable rpc-write-audit clone; changes only 14 function bodies.
-- NOT for Supabase production. NO data mutation, grants, or RLS policy changes.
-- PostgreSQL CREATE OR REPLACE FUNCTION retains existing permissions.
-- Re-run safe: already-guarded functions are skipped.
DO $harden$
DECLARE
  expected_names text[] := ARRAY[
    'terravale_divine_canon_dm_adjust_burden',
    'terravale_divine_canon_dm_fracture',
    'terravale_divine_canon_dm_offer',
    'terravale_divine_canon_dm_record_bargain',
    'terravale_divine_canon_dm_refill',
    'terravale_divine_canon_dm_resolve_fracture',
    'terravale_divine_canon_dm_resolve_offer',
    'terravale_divine_canon_dm_set_effect',
    'terravale_divine_canon_dm_set_relation',
    'terravale_divine_canon_dm_set_status',
    'terravale_divine_canon_respond_offer',
    'terravale_divine_canon_rest',
    'terravale_divine_canon_revoke',
    'terravale_divine_canon_use'
  ];
  record_data record;
  source_definition text;
  guarded integer := 0;
  unchanged integer := 0;
  total_functions integer;
  replacement text := $new_begin$begin
 -- TERRAVALE_NEON_PRELOCK_IDENTITY_GUARD
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then
   raise exception 'Verified Discord required before private state access' using errcode='28000';
 end if;$new_begin$;
BEGIN
  SELECT count(*) INTO total_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname = ANY(expected_names)
    AND p.prosecdef;
  IF total_functions<>14 THEN
    RAISE EXCEPTION 'Expected 14 SECURITY DEFINER canonical actions, found %',total_functions;
  END IF;
  FOR record_data IN
    SELECT p.oid,p.proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname = ANY(expected_names) AND p.prosecdef
    ORDER BY p.proname
  LOOP
    source_definition := pg_get_functiondef(record_data.oid);
    IF position('TERRAVALE_NEON_PRELOCK_IDENTITY_GUARD' IN source_definition)>0 THEN
      unchanged := unchanged+1;
      CONTINUE;
    END IF;
    IF regexp_count(source_definition,'\mbegin\M',1,'i') <> 1
      OR source_definition !~* 'actor\s+uuid\s*:?=\s*\(?select\s+auth\.uid\(\)'
      OR ltrim(split_part(lower(source_definition),'begin',2)) NOT LIKE 'select * into %'
      OR strpos(left(split_part(lower(source_definition),'begin',2),350),'for update')=0
    THEN
      RAISE EXCEPTION 'Unexpected function layout for %, refusing partial patch',
        record_data.proname;
    END IF;
    EXECUTE regexp_replace(source_definition,'\mbegin\M',replacement,'i');
    guarded:=guarded+1;
  END LOOP;
  IF guarded+unchanged<>14 THEN
    RAISE EXCEPTION 'Pre-lock patch incomplete (% new + % existing)',guarded,unchanged;
  END IF;
END $harden$;
