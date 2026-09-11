create table household (
  id bigserial primary key,
  name varchar(80) not null,
  points_per_currency_unit numeric(6,2) not null default 1.00,
  currency varchar(3) not null default 'ZAR',
  season_name varchar(40) not null default 'Season 1',
  season_start date not null default current_date
);

create table parent (
  id bigserial primary key,
  household_id bigint not null references household(id),
  name varchar(60) not null,
  email varchar(120) not null unique,
  password_hash varchar(120) not null,
  push_token varchar(400)
);

create table kid (
  id bigserial primary key,
  household_id bigint not null references household(id),
  callsign varchar(20) not null,
  theme_code varchar(20) not null default 'AIRSOFT',
  balance int not null default 0,
  lifetime_earned int not null default 0,
  rank_ordinal int not null default 0,
  streak_days int not null default 0,
  streak_last_date date,
  prestige_stars int not null default 0
);

create table device (
  id bigserial primary key,
  kid_id bigint not null references kid(id),
  pairing_code varchar(8),
  device_token varchar(64) unique,
  paired_at timestamptz,
  last_seen_at timestamptz
);

create table behaviour (
  id bigserial primary key,
  household_id bigint not null references household(id),
  title varchar(80) not null,
  points int not null check (points > 0),
  kind varchar(10) not null,            -- DAILY | WEEKLY | BONUS
  requires_photo boolean not null default true,
  bonus_date date,
  active boolean not null default true
);

create table mission_completion (
  id bigserial primary key,
  kid_id bigint not null references kid(id),
  behaviour_id bigint not null references behaviour(id),
  mission_date date not null,
  status varchar(10) not null,          -- PENDING | APPROVED | SENT_BACK
  photo_key varchar(200),
  submitted_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by bigint references parent(id),
  note varchar(200),
  unique (kid_id, behaviour_id, mission_date)
);

create table point_entry (
  id bigserial primary key,
  kid_id bigint not null references kid(id),
  points int not null,
  type varchar(15) not null,            -- MISSION | BONUS | STREAK_BONUS | REDEMPTION | CORRECTION
  ref_id bigint,
  reason varchar(120),
  created_at timestamptz not null default now(),
  created_by bigint
);
create index ix_point_entry_kid on point_entry(kid_id, created_at);

create table reward (
  id bigserial primary key,
  kid_id bigint not null references kid(id),
  name varchar(80) not null,
  category varchar(12) not null,        -- GEAR | GAME_TIME | OUTING | TREAT | OTHER
  estimated_cost numeric(9,2),
  price int,
  tier int,
  status varchar(10) not null,          -- PENDING | ACTIVE | DECLINED | RETIRED
  suggested_by_kid boolean not null default false,
  manual_price boolean not null default false,
  is_term_goal boolean not null default false,
  repeatable boolean not null default false
);

create table redemption (
  id bigserial primary key,
  kid_id bigint not null references kid(id),
  reward_id bigint not null references reward(id),
  price_paid int not null,
  redeemed_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  fulfilled_by bigint references parent(id)
);

create table celebration (
  id bigserial primary key,
  kid_id bigint not null references kid(id),
  type varchar(20) not null,
  points int,
  ref_id bigint,
  payload varchar(200),
  created_at timestamptz not null default now(),
  played_at timestamptz
);
create index ix_celebration_unplayed on celebration(kid_id) where played_at is null;

create table rank_definition (
  theme_code varchar(20) not null,
  ordinal int not null,
  name varchar(30) not null,
  threshold int not null,
  primary key (theme_code, ordinal)
);

insert into rank_definition values
 ('AIRSOFT',0,'Recruit',0),('AIRSOFT',1,'Private',100),('AIRSOFT',2,'Corporal',300),('AIRSOFT',3,'Sergeant',700),
 ('AIRSOFT',4,'Lieutenant',1400),('AIRSOFT',5,'Captain',2500),('AIRSOFT',6,'Major',4000),('AIRSOFT',7,'Commander',6000),
 ('HERO',0,'Sidekick',0),('HERO',1,'Cadet',100),('HERO',2,'Titan 1',300),('HERO',3,'Titan 2',700),
 ('HERO',4,'Titan 3',1400),('HERO',5,'Hero',2500),('HERO',6,'Champion',4000),('HERO',7,'Legend',6000);

create table squad_goal (
  id bigserial primary key,
  household_id bigint not null references household(id),
  name varchar(80) not null,
  target_points int not null,
  season_name varchar(40) not null,
  status varchar(10) not null default 'ACTIVE'
);
