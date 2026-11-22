-- AUDIT ONLY — Never install on Neon staging/main or production Supabase.
-- This rejection trigger applies ONLY to the three synthetic characters
-- created in the disposable resource round-trip Neon child branch.
-- A broad sheet writer must never silently revert an existing resource
-- revision, even if its outer non-resource fields are legitimate.
CREATE OR REPLACE FUNCTION terravale_internal.neon_audit_resource_overwrite_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $guard$
DECLARE
 old_rev integer;
 new_rev integer;
 old_map jsonb;
 new_map jsonb;
BEGIN
 IF OLD.id NOT IN (
   '11111111-1111-4111-8111-999999999991'::uuid,
   '11111111-1111-4111-8111-999999999992'::uuid,
   '11111111-1111-4111-8111-999999999993'::uuid
 ) OR OLD.name NOT LIKE 'Neon resource audit %' THEN
   RETURN NEW;
 END IF;
 old_map:=OLD.approved_build#>'{character,sheetV220,resources}';
 new_map:=NEW.approved_build#>'{character,sheetV220,resources}';
 old_rev:=COALESCE((OLD.approved_build#>>'{character,sheetV220,resourceRevision}')::integer,0);
 new_rev:=COALESCE((NEW.approved_build#>>'{character,sheetV220,resourceRevision}')::integer,0);
 IF jsonb_typeof(new_map) IS DISTINCT FROM 'object'
   OR new_rev<old_rev OR new_rev>old_rev+1
   OR (new_map IS DISTINCT FROM old_map AND new_rev=old_rev) THEN
   RAISE EXCEPTION 'Stale or unsupported whole-sheet resource overwrite denied'
     USING errcode='40001';
 END IF;
 RETURN NEW;
END
$guard$;
-- AUDIT STATEMENT
REVOKE ALL ON FUNCTION terravale_internal.neon_audit_resource_overwrite_guard()
 FROM PUBLIC,authenticated,anonymous;
-- AUDIT STATEMENT
CREATE TRIGGER neon_audit_resource_guard
 BEFORE UPDATE OF approved_build ON public.characters
 FOR EACH ROW EXECUTE FUNCTION terravale_internal.neon_audit_resource_overwrite_guard();
