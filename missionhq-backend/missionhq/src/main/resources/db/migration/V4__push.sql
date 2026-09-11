create table push_subscription (
  id bigserial primary key,
  owner_type varchar(10) not null,      -- KID | PARENT
  owner_id bigint not null,
  endpoint varchar(600) not null unique,
  p256dh varchar(200) not null,
  auth varchar(100) not null,
  created_at timestamptz not null default now()
);
create index ix_push_owner on push_subscription(owner_type, owner_id);
