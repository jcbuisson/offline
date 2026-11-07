BEGIN;
CREATE TABLE IF NOT EXISTS "user" (uid TEXT PRIMARY KEY, firstname TEXT, lastname TEXT, email TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS "group" (uid TEXT PRIMARY KEY, name TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS user_group_relation (
   uid TEXT PRIMARY KEY,
   user_uid TEXT REFERENCES "user"(uid) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
   group_uid TEXT REFERENCES "group"(uid) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
   UNIQUE (user_uid, group_uid)
);
-- Preserve active Electric rows; discard only already deleted tombstones.
DO $$
DECLARE model TEXT; constraint_name TEXT;
BEGIN
   FOREACH model IN ARRAY ARRAY['user_group_relation', 'user', 'group'] LOOP
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = model AND column_name = 'deleted') THEN
         EXECUTE format('DELETE FROM %I WHERE deleted = true', model);
      END IF;
      EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS version, DROP COLUMN IF EXISTS deleted', model);
   END LOOP;
   FOR constraint_name IN SELECT conname FROM pg_constraint WHERE conrelid = 'user_group_relation'::regclass AND contype = 'f' LOOP
      EXECUTE format('ALTER TABLE user_group_relation ALTER CONSTRAINT %I DEFERRABLE INITIALLY DEFERRED', constraint_name);
   END LOOP;
END $$;
COMMIT;
