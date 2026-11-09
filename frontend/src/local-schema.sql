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

-- jsonb_populate_record inserts NULL for metadata absent from current snapshots;
-- column defaults only apply when the INSERT omits the column altogether.
CREATE OR REPLACE FUNCTION pgcouch_normalize_deleted() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
   NEW.deleted := COALESCE(NEW.deleted, false);
   RETURN NEW;
END $$;
DO $$
DECLARE model TEXT;
BEGIN
   FOREACH model IN ARRAY ARRAY['user', 'group', 'user_group_relation'] LOOP
      EXECUTE format('UPDATE %I SET deleted = false WHERE deleted IS NULL', model);
      EXECUTE format('DROP TRIGGER IF EXISTS pgcouch_normalize_deleted ON %I', model);
      EXECUTE format('CREATE TRIGGER pgcouch_normalize_deleted BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pgcouch_normalize_deleted()', model);
   END LOOP;
END $$;
