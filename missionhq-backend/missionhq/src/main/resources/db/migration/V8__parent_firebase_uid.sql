-- A parent signs in through Firebase Authentication; firebase_uid is the Firebase user id (the ID token's `sub`).
-- It is attached on first sign-in with a verified email matching the parent row. password_hash only backs the
-- HTTP Basic sign-in kept for one transition release, so parents who only ever use Firebase have none.
alter table parent add column firebase_uid varchar(128) unique;
alter table parent alter column password_hash drop not null;
