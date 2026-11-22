-- AUDIT ONLY: disposable Neon child branch. These are deliberately fake
-- auth rows, with no OAuth access tokens and no real Discord account.
-- They simulate a second linked, non-DM party member to exercise
-- auth.uid() -> campaign membership -> character ownership denial.
INSERT INTO auth.users(id,raw_user_meta_data)
VALUES('33333333-3333-4333-8333-333333333302'::uuid,
 jsonb_build_object('audit','synthetic-only'));
-- AUDIT STATEMENT
INSERT INTO neon_auth."user"(id,name,email,"emailVerified","updatedAt")
VALUES('33333333-3333-4333-8333-333333333301'::uuid,
 'Synthetic Second Tester','audit-second@invalid.example',false,now());
-- AUDIT STATEMENT
INSERT INTO neon_auth.account
 (id,"accountId","providerId","userId","updatedAt")
VALUES(
 '33333333-3333-4333-8333-333333333303'::uuid,
 'audit-synthetic-discord-second-20261122','discord',
 '33333333-3333-4333-8333-333333333301'::uuid,now()
);
-- AUDIT STATEMENT
INSERT INTO auth.identities(id,user_id,provider,provider_id,identity_data)
VALUES('33333333-3333-4333-8333-333333333304'::uuid,
 '33333333-3333-4333-8333-333333333302'::uuid,
 'discord','audit-synthetic-discord-second-20261122',
 jsonb_build_object('audit','synthetic-only'));
-- AUDIT STATEMENT
INSERT INTO public.campaign_members(campaign_id,user_id,role)
VALUES('11111111-1111-4111-8111-999999999982'::uuid,
 '33333333-3333-4333-8333-333333333302'::uuid,'player');
