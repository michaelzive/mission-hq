-- Completes the V2 dev seed: mission_completion.reviewed_by has a FK to parent(id),
-- so without a parent row no mission can be approved. Dev-only credentials.
insert into parent (household_id, name, email, password_hash) values
 (1,'Dev Parent','parent@example.com','$2a$10$vfDjw0NrPTNSGSJrjA1NK.WyWh4Pn/2HJ3j3eXjSfoVkrpKXXa0qS');
