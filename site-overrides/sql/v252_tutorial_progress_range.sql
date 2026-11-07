-- V2.52: allow the sixteen-stage campaign invitation walkthrough to persist
-- through its completion step. Old progress values remain valid.
alter table public.terravale_user_preferences
 drop constraint if exists terravale_user_preferences_tutorial_last_step_check;
alter table public.terravale_user_preferences
 add constraint terravale_user_preferences_tutorial_last_step_check
 check(tutorial_last_step between 0 and 20);
