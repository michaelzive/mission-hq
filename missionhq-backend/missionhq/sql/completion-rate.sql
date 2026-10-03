-- How reliably each kid reports missions, week by week, over the last 8 weeks.
-- Paste into the Neon SQL editor (missionhq-prod) before a change and again a couple of weeks after it.
--
--   reports            missions the kid reported that week (pending or approved; sent back and never redone doesn't count)
--   days_with_report   how many of the 7 days had at least one report -- the number streaks depend on
--   parent_logged      missions a parent logged instead (always 0 before V12)
--
-- The current week is partial. Mission lists change over time and aren't versioned, so compare like with like:
-- the same kids, weeks with roughly the same missions.
-- logged_by_parent is read through to_jsonb so the same query runs before and after V12 adds the column.
with weeks as (
  select generate_series(date_trunc('week', current_date - 7 * 7), date_trunc('week', current_date), interval '1 week')::date as week
),
reports as (
  select c.kid_id, c.mission_date, coalesce((to_jsonb(c) ->> 'logged_by_parent')::boolean, false) as by_parent
  from mission_completion c
  where c.status in ('PENDING', 'APPROVED')
)
select k.callsign,
       w.week,
       count(r.kid_id) filter (where not r.by_parent)                   as reports,
       count(distinct r.mission_date) filter (where not r.by_parent)    as days_with_report,
       count(r.kid_id) filter (where r.by_parent)                       as parent_logged
from kid k
cross join weeks w
left join reports r on r.kid_id = k.id and r.mission_date >= w.week and r.mission_date < w.week + 7
group by k.callsign, w.week
order by k.callsign, w.week;
