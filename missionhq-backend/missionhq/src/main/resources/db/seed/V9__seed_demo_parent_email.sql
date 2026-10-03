-- Dev only. dad@example.com can't receive mail, so it can never verify a Firebase sign-in and link to the demo household.
-- This hands the demo parent to the configured PARENT_EMAIL (application-dev.yml passes it in as a Flyway placeholder),
-- so signing in with Google as that address lands among the demo kids. A no-op when PARENT_EMAIL is left at the default.
-- Runs once per database: set PARENT_EMAIL before the first start that applies it.
update parent set email = '${demo_parent_email}'
 where email = 'dad@example.com'
   and not exists (select 1 from parent where lower(email) = lower('${demo_parent_email}'));
