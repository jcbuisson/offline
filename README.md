# Offline

Excellent review: https://www.smashingmagazine.com/2026/05/architecture-local-first-web-development/

## Local Electric

Electric runs in Docker and connects to the PostgreSQL server installed on the
host. PostgreSQL must have logical replication enabled (`wal_level=logical`),
and the database user must have the `REPLICATION` role.

Set Electric's database URL using `host.docker.internal` rather than `localhost`
(because `localhost` inside the container refers to the container itself), then
start the service:

```bash
export ELECTRIC_DATABASE_URL='postgresql://USER:PASSWORD@host.docker.internal:5432/offline?sslmode=disable'
docker compose -f backend/docker-compose.yml up -d
```

Electric is available at `http://localhost:3001`. Check it with
`docker compose -f backend/docker-compose.yml ps`, view its output with
`docker compose -f backend/docker-compose.yml logs -f electric`, and stop it
with `docker compose -f backend/docker-compose.yml down`. The backend continues
to use its existing `DATABASE_URL` in `backend/.env` and can connect to
PostgreSQL through `localhost` as before.

`ELECTRIC_INSECURE` is enabled for local development. Configure
`ELECTRIC_SECRET` before exposing Electric outside your machine.

### First-time database setup

Create the empty database and grant the application user replication rights.
Run these commands as a PostgreSQL administrator, replacing `APP_USER` as
needed:

```sql
CREATE DATABASE offline;
ALTER ROLE APP_USER WITH REPLICATION;
```

PostgreSQL must also be started with `wal_level=logical`. Verify it with:

```bash
psql -d offline -c "SHOW wal_level;"
```

Set `backend/.env` to the host-side connection URL, for example:

```dotenv
DATABASE_URL="postgresql://APP_USER:PASSWORD@localhost:5432/offline"
```

Create the schema from the Prisma model:

```bash
cd backend
npx prisma db execute --stdin <<'SQL'
CREATE SEQUENCE IF NOT EXISTS electric_sync_version_seq;
SQL
npx prisma db push
```

### Development

Run each process in a separate terminal from the repository root:

```bash
# Terminal 1: Electric
export ELECTRIC_DATABASE_URL='postgresql://APP_USER:PASSWORD@host.docker.internal:5432/offline?sslmode=disable'
docker compose -f backend/docker-compose.yml up

# Terminal 2: backend (http://localhost:3000)
cd backend
npm install
npm run dev

# Terminal 3: frontend (http://localhost:8080)
cd frontend
npm install
npm run dev
```

### Production
Add this to /etc/postgresql/17/main/pg_hba.conf to allow Electric’s Docker network to access offline:
```
host    offline    chris    172.19.0.0/16    scram-sha-256
```

Verify the sync endpoint:
```
curl -i 'https://offline.jcbuisson.dev/electric/v1/shape/user?offset=-1'
```


### Sync mode

The backend enables `sync: true` and prepares the sync schema before listening.
Startup creates `electric_mutation_cursor`, the shared version sequence, and
`version`/`deleted` columns on the three application tables. Existing data is
preserved. Prisma also describes these columns and the cursor table.

The frontend plugin prepares a persistent PGlite database in IndexedDB automatically.
All three models read and write locally; queued writes are retried and confirmed
through Electric. Tabs share this database; a Web Lock per model elects the tab
that runs Electric subscriptions and mutation retries. Another tab takes over when it closes.
This follows PGlite's [multi-tab worker setup](https://pglite.dev/docs/multi-tab-worker).

Deletes retain versioned tombstones. Deleted users/groups release their unique
email/name, and deleted relations clear their nullable foreign keys so the same
membership can be added again. Continue explicitly deleting memberships when
deleting a user or group: soft deletes do not trigger PostgreSQL cascades.

Production builds precache PGlite's WASM and database assets for offline reloads.
The development server does not enable the service worker, so a fully offline
reload should be tested using a production build. Keep browser storage to preserve
pending edits and the client identity; clearing it discards unsent changes.

Before building a production release, install the frontend dependencies:

```sh
cd frontend
npm install
npm run build
```

The build checks that the installed plugin supports managed sync. Deploy the
complete generated `dist` directory, including workers and service worker assets.


## Pros

- a relational database schema!
- real-time!
- offline-first!
- extensive use of observables, ideal for all types of reactive frameworks (React, Vue, etc.)

## Cons

- no autoincremented ids, only uuids (v7)
- many-to-many relations must be explicitly described
- relations must be explicitly deleted, even with ondelete-cascade
- extensive use of observables

## Typical usage

```
const { getObservable: groups$, remove: removeGroup } = useGroup()
const { getObservable: groupRelations$ } = useGroupRelation()
...
const groupList = useObservable(groups$(), [])
...
watch(() => props.group_uid, (group_uid) => {
    if (subscription) subscription.unsubscribe()
    subscription = groupRelations$({ group_uid }).subscribe(groupRelationList => {
        ...
    }
}, { immediate: true })
```
