-- A reward belongs to one kid (their own shop, may be their term goal) or to the whole household (everyone's shop).
alter table reward alter column kid_id drop not null;
alter table reward add column household_id bigint references household(id);
alter table reward add constraint reward_owner check ((kid_id is null) <> (household_id is null));
create index ix_reward_household on reward(household_id) where household_id is not null;
