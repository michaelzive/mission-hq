-- A parent invites another parent into their household with a single-use link that expires after 7 days. Only the
-- SHA-256 of the link's token is stored, so the table can't be used to accept invites.
create table parent_invite (
  id bigserial primary key,
  household_id bigint not null references household(id),
  token_hash varchar(64) not null unique,
  created_by bigint not null references parent(id),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  accepted_by bigint references parent(id),
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index ix_parent_invite_household on parent_invite(household_id);

-- Removing a parent keeps the row (past approvals and deliveries point at it) but strips its sign-in: email and
-- firebase_uid are cleared, so the same person can be invited again later.
alter table parent alter column email drop not null;
alter table parent add column removed_at timestamptz;
