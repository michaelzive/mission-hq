-- Completes the V2 dev seed: mission_completion.reviewed_by has a FK to parent(id), so without a parent row no
-- mission can be approved. The email matches the missionhq.parent.email default so ParentBootstrap attaches the
-- configured password to this household on startup instead of creating a second one; the hash here is a placeholder.
insert into parent (household_id, name, email, password_hash) values
 (1,'Dev Parent','dad@example.com','bootstrap-sets-this-on-startup');
