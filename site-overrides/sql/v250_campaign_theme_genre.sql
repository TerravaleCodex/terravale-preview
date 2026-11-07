-- V2.50 campaign metadata — independently editable, player-visible Theme / Genre.
-- Keep pre-existing description (tagline) and long_description unchanged.
alter table public.campaigns
  add column if not exists theme text not null default '',
  add column if not exists genre text not null default '';
do $$
begin
 if not exists (select 1 from pg_constraint where conname='campaign_theme_length' and conrelid='public.campaigns'::regclass) then
  alter table public.campaigns add constraint campaign_theme_length check(char_length(theme)<=240);
 end if;
 if not exists (select 1 from pg_constraint where conname='campaign_genre_length' and conrelid='public.campaigns'::regclass) then
  alter table public.campaigns add constraint campaign_genre_length check(char_length(genre)<=240);
 end if;
end $$;
grant update(theme,genre) on public.campaigns to authenticated;
comment on column public.campaigns.theme is 'Narrative topics and motifs, e.g. grief, isolation, sacrifice.';
comment on column public.campaigns.genre is 'Story genre, e.g. dark fantasy, mystery, survival horror.';
