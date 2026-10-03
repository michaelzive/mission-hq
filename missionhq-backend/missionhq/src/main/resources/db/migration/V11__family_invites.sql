-- An invite is either into an existing household (PARENT) or for a new family (FAMILY): accepting a FAMILY invite creates
-- a household with that person as its first parent. Only admins (missionhq.admin-emails) create FAMILY invites.
alter table parent_invite add column kind varchar(10) not null default 'PARENT';
alter table parent_invite alter column household_id drop not null;
alter table parent_invite add constraint parent_invite_kind check ((kind = 'FAMILY') = (household_id is null));
