CREATE TABLE IF NOT EXISTS "user" (uid TEXT PRIMARY KEY, firstname TEXT, lastname TEXT, email TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS "group" (uid TEXT PRIMARY KEY, name TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS user_group_relation (
   uid TEXT PRIMARY KEY,
   user_uid TEXT REFERENCES "user"(uid) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
   group_uid TEXT REFERENCES "group"(uid) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
   UNIQUE (user_uid, group_uid)
);

-- Previously published snapshots are immutable and may contain Electric metadata.
-- Retain compatibility until those snapshots have been superseded.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;
ALTER TABLE "group" ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
ALTER TABLE "group" ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;
ALTER TABLE user_group_relation ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false;
ALTER TABLE user_group_relation ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0;
