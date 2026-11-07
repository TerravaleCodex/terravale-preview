-- V2.49: keep public.campaigns.description as the short tagline/quote;
-- introduce an independent long-form campaign story without replacing the quote.
alter table public.campaigns
  add column if not exists long_description text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.campaigns'::regclass
      and conname='campaign_long_description_length'
  ) then
    alter table public.campaigns
      add constraint campaign_long_description_length
      check (char_length(long_description) <= 12000);
  end if;
end $$;

comment on column public.campaigns.description is
 'Short campaign tagline or atmospheric quote, preserved from earlier V2 campaigns.';
comment on column public.campaigns.long_description is
 'Optional long-form player-facing campaign description; paragraph breaks are preserved.';

-- Existing RLS UPDATE rules still restrict writes to verified campaign DMs.
-- Grant column-level privileges only; do not allow ownership, ID or name updates.
grant update (description,long_description)
  on table public.campaigns to authenticated;