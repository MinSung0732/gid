create table public.harmony_achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null default '◇',
  reward jsonb not null default '[]'::jsonb,
  hidden boolean not null default false,
  hide_reward boolean not null default false,
  sort_order integer not null unique check (sort_order > 0),
  created_at timestamptz not null default now(),
  constraint harmony_achievements_reward_array check (jsonb_typeof(reward) = 'array')
);

comment on table public.harmony_achievements is
  'Presentation mirror of the canonical Harmony UNLOCKS catalog. Game unlock rules remain in the client engine.';

create table public.harmony_user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.harmony_achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

comment on table public.harmony_user_achievements is
  'Append-only server mirror of player_state.payload.meta.unlocked for achievement presentation and aggregate statistics.';

create table public.harmony_achievement_stats (
  achievement_id text primary key references public.harmony_achievements(id) on delete cascade,
  clear_count bigint not null default 0 check (clear_count >= 0),
  eligible_player_count bigint not null default 0 check (eligible_player_count >= 0),
  clear_rate numeric(5, 1),
  updated_at timestamptz not null default now(),
  constraint harmony_achievement_stats_rate check (clear_rate is null or clear_rate between 0 and 100)
);

comment on table public.harmony_achievement_stats is
  'Cached public aggregate. Eligible players have a started run, a completed run count, or a recorded run result.';

alter table public.harmony_achievements enable row level security;
alter table public.harmony_user_achievements enable row level security;
alter table public.harmony_achievement_stats enable row level security;

create policy harmony_achievements_public_read
on public.harmony_achievements for select
to anon, authenticated
using (true);

create policy harmony_user_achievements_select_own
on public.harmony_user_achievements for select
to authenticated
using ((select auth.uid()) = user_id);

create policy harmony_achievement_stats_public_read
on public.harmony_achievement_stats for select
to anon, authenticated
using (true);

grant select on public.harmony_achievements to anon, authenticated;
grant select on public.harmony_achievement_stats to anon, authenticated;
grant select on public.harmony_user_achievements to anon, authenticated;

insert into public.harmony_achievements
  (id, name, description, icon, reward, hidden, hide_reward, sort_order)
values
  ('trait_celestial_accord_echo', '첫 번째 조화', '누적 하모니 10회 완성', '✦', '[{"kind":"item","id":"trait_celestial_accord_echo","label":"천상의 화음 반향"}]', false, false, 1),
  ('relic_chimeric_alembic', '피라미드 마스터', '한 전투에서 하모니 3회 완성', '△', '[{"kind":"item","id":"relic_chimeric_alembic","label":"키메라의 알렘빅"}]', false, false, 2),
  ('relic_merchants_diplomatic_seal', '황금빛 탐욕', '한 여정에서 150골드 보유', '◈', '[{"kind":"item","id":"relic_merchants_diplomatic_seal","label":"상인 길드의 외교 인장"}]', false, false, 3),
  ('relic_philosophers_mercury_still', '심연의 계약자', '저주 2개 이상 보유한 채 승리', '☿', '[{"kind":"item","id":"relic_philosophers_mercury_still","label":"현자의 수은 증류기"}]', false, false, 4),
  ('relic_aegis_of_the_eternal_wax', '철벽의 연금술', '단일 턴 방어막 60 달성', '⬡', '[{"kind":"item","id":"relic_aegis_of_the_eternal_wax","label":"영겁 밀랍의 이지스"}]', false, false, 5),
  ('relic_infinite_fragrance_reservoir', '향액의 대식가', '흡수 80 달성', '◉', '[{"kind":"item","id":"relic_infinite_fragrance_reservoir","label":"무한 향기의 저수조"}]', false, false, 6),
  ('relic_chronos_sandglass_of_scent', '시간을 달리는 자', '15턴 이상 생존 후 승리', '⌛', '[{"kind":"item","id":"relic_chronos_sandglass_of_scent","label":"크로노스의 향기 모래시계"}]', false, false, 7),
  ('relic_primordial_essence_heart', '불사조의 날개', '체력 5 이하로 승리', '♢', '[{"kind":"item","id":"relic_primordial_essence_heart","label":"원초의 에센스 심장"},{"kind":"card","id":"heal_miracle_transmutation","label":"기적의 연성"}]', false, false, 8),
  ('trait_infinite_resonance_flurry', '연속 타격의 귀재', '한 턴에 접촉 카드 5장 사용', '✺', '[{"kind":"item","id":"trait_infinite_resonance_flurry","label":"무한 연타의 잔향 폭풍"}]', false, false, 9),
  ('trait_prismatic_hyper_beam', '원거리의 지배자', '비접촉 공격으로 첫 턴 승리', '◇', '[{"kind":"item","id":"trait_prismatic_hyper_beam","label":"초임계 무지개 굴절광"}]', false, false, 10),
  ('relic_expanded_atelier_case', '빅덱 애호가', '덱 카드 16장 달성', '▣', '[{"kind":"item","id":"relic_expanded_atelier_case","label":"확장된 아틀리에 수납함"}]', false, false, 11),
  ('relic_faded_recipe_scrap', '미니멀리스트', '덱 6장 이하로 승리', '▱', '[{"kind":"item","id":"relic_faded_recipe_scrap","label":"빛바랜 조향 레시피 쪽지"}]', false, false, 12),
  ('absorb_corrosive_extraction_strike', '부식의 군주', '적에게 부식 10중첩', '♨', '[{"kind":"card","id":"absorb_corrosive_extraction_strike","label":"부식성 추출 타격"}]', false, false, 13),
  ('contact_cauterizing_brand', '화염의 연금술사', '적에게 화상 12중첩', '♨', '[{"kind":"card","id":"contact_cauterizing_brand","label":"초고온 밀랍 분사"}]', false, false, 14),
  ('trait_spiked_crystalline_barrier', '가시의 요새', '가시 피해로 적 처치', '✧', '[{"kind":"item","id":"trait_spiked_crystalline_barrier","label":"결정체 가시 장벽"}]', false, false, 15),
  ('boss_corrupted_perfumer', '마스터 퍼퓨머', '1막 보스를 체력 피해 없이 격파', 'Ⅰ', '[]', false, false, 16),
  ('boss_primeval_lily', '태초의 정원사', '온실에서 완전 회복', '❀', '[{"kind":"card","id":"heal_primordial_dew_elixir","label":"태초의 새벽 엘릭서"}]', false, false, 17),
  ('boss_golden_perfumer', '심연의 도전자', '2막 3회 클리어', 'Ⅱ', '[]', false, false, 18),
  ('boss_abyssal_lily', '백합의 정화자', '불순물 15장 누적 정화', '✿', '[]', false, false, 19),
  ('boss_lord_of_harmony', '절대 조화 도달', '3막 최종 루프 1회 완주', 'Ⅲ', '[]', false, false, 20);

create or replace function public.refresh_harmony_achievement_stats()
returns void
language sql
security definer
set search_path = ''
as $$
  with eligible as (
    select ps.user_id
    from public.player_state ps
    where coalesce((ps.payload #>> '{meta,totalRuns}')::integer, 0) > 0
       or (ps.payload->'run' is not null and ps.payload->'run' <> 'null'::jsonb)
       or exists (select 1 from public.run_results rr where rr.user_id = ps.user_id)
  ), totals as (
    select count(*)::bigint as eligible_player_count from eligible
  ), clears as (
    select ua.achievement_id, count(*)::bigint as clear_count
    from public.harmony_user_achievements ua
    join eligible e on e.user_id = ua.user_id
    group by ua.achievement_id
  )
  insert into public.harmony_achievement_stats
    (achievement_id, clear_count, eligible_player_count, clear_rate, updated_at)
  select
    achievement.id,
    coalesce(clears.clear_count, 0),
    totals.eligible_player_count,
    case
      when totals.eligible_player_count = 0 then null
      else round(coalesce(clears.clear_count, 0) * 100.0 / totals.eligible_player_count, 1)
    end,
    now()
  from public.harmony_achievements achievement
  cross join totals
  left join clears on clears.achievement_id = achievement.id
  on conflict (achievement_id) do update set
    clear_count = excluded.clear_count,
    eligible_player_count = excluded.eligible_player_count,
    clear_rate = excluded.clear_rate,
    updated_at = excluded.updated_at;
$$;

revoke all on function public.refresh_harmony_achievement_stats() from public, anon, authenticated;

create or replace function public.sync_harmony_user_achievements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.harmony_user_achievements (user_id, achievement_id, unlocked_at)
  select
    new.user_id,
    achievement.id,
    coalesce(new.client_saved_at, new.updated_at, now())
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(new.payload #> '{meta,unlocked}') = 'array'
        then new.payload #> '{meta,unlocked}'
      else '[]'::jsonb
    end
  ) unlocked(id)
  join public.harmony_achievements achievement on achievement.id = unlocked.id
  on conflict (user_id, achievement_id) do nothing;

  perform public.refresh_harmony_achievement_stats();
  return new;
end;
$$;

revoke all on function public.sync_harmony_user_achievements() from public, anon, authenticated;

create trigger sync_harmony_user_achievements_after_save
after insert or update of payload on public.player_state
for each row execute function public.sync_harmony_user_achievements();

create or replace function public.refresh_harmony_stats_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_harmony_achievement_stats();
  return null;
end;
$$;

revoke all on function public.refresh_harmony_stats_after_change() from public, anon, authenticated;

create trigger refresh_harmony_stats_after_player_change
after insert or update or delete on public.player_state
for each statement execute function public.refresh_harmony_stats_after_change();

create trigger refresh_harmony_stats_after_result_change
after insert or update or delete on public.run_results
for each statement execute function public.refresh_harmony_stats_after_change();

insert into public.harmony_user_achievements (user_id, achievement_id, unlocked_at)
select
  player.user_id,
  achievement.id,
  coalesce(player.client_saved_at, player.updated_at, now())
from public.player_state player
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(player.payload #> '{meta,unlocked}') = 'array'
      then player.payload #> '{meta,unlocked}'
    else '[]'::jsonb
  end
) unlocked(id)
join public.harmony_achievements achievement on achievement.id = unlocked.id
on conflict (user_id, achievement_id) do nothing;

select public.refresh_harmony_achievement_stats();

create or replace function public.get_harmony_achievement_summary()
returns table (
  achievement_id text,
  name text,
  description text,
  icon text,
  reward jsonb,
  hidden boolean,
  hide_reward boolean,
  sort_order integer,
  unlocked boolean,
  unlocked_at timestamptz,
  clear_count bigint,
  eligible_player_count bigint,
  clear_rate numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    achievement.id,
    achievement.name,
    achievement.description,
    achievement.icon,
    achievement.reward,
    achievement.hidden,
    achievement.hide_reward,
    achievement.sort_order,
    (user_achievement.achievement_id is not null),
    user_achievement.unlocked_at,
    coalesce(stats.clear_count, 0),
    coalesce(stats.eligible_player_count, 0),
    stats.clear_rate
  from public.harmony_achievements achievement
  left join public.harmony_achievement_stats stats
    on stats.achievement_id = achievement.id
  left join public.harmony_user_achievements user_achievement
    on user_achievement.achievement_id = achievement.id
   and user_achievement.user_id = (select auth.uid())
  order by achievement.sort_order;
$$;

revoke all on function public.get_harmony_achievement_summary() from public;
grant execute on function public.get_harmony_achievement_summary() to anon, authenticated;
