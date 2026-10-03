-- The household's own clock: a kid's "today", the late-report window and the evening reminder all run on local time,
-- not the server's (Cloud Run is UTC).
alter table household add column timezone varchar(40) not null default 'Africa/Johannesburg';
-- Local wall-clock 'HH:mm' of the evening reminder; null = none. Text, not time: hibernate.jdbc.time_zone=UTC would
-- shift a LocalTime by the JVM's zone, and a time of day has no zone.
alter table household add column reminder_time varchar(5) default '18:30' check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
-- Claimed atomically by whichever instance sends the day's reminder, so it goes out once.
alter table household add column last_reminder_date date;
-- A mission a parent logs for a kid pays this share of its points, so reporting it yourself stays the better deal.
alter table household add column parent_log_percent int not null default 50 check (parent_log_percent between 1 and 100);

-- Logged by a parent rather than reported by the kid: paid at the parent-log rate and never counts toward the streak.
alter table mission_completion add column logged_by_parent boolean not null default false;
-- What the mission actually paid (before any extra bonus); null for reports not yet approved.
alter table mission_completion add column points_awarded int;

-- The streak is now recomputed from history, so a milestone bonus must not be paid twice. This is the latest
-- milestone day already paid; everything up to the last streak day counts as settled under the old rules.
alter table kid add column streak_bonus_through date;
update kid set streak_bonus_through = streak_last_date;
