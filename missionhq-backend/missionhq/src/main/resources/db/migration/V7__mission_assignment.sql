-- A mission is for the whole household (kid_id null) or directed at one kid. BehaviourService keeps the kid in the
-- mission's household; a check constraint can't see across tables.
alter table behaviour add column kid_id bigint references kid(id);
create index ix_behaviour_kid on behaviour(kid_id) where kid_id is not null;
