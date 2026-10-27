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
curl -i 'https://offline.jcbuisson.dev/electric-sql/v1/shape/user?offset=-1'
```


### SQL plugin

Frontend and backend use express-x-plugins 5.1.0's `electric-sql-client` and
`electric-sql-server`. Named, parameterized statements are in `backend/src/sql.js`.
The browser uses `app.sql.query` for writes and `app.sql.watch` for live table rows.
This public demo allows all clients to access these operations.

Writes require connectivity. Electric still provides live reads. There is no
persistent local database or offline write queue. Synchronize any pending edits
with the previous app before upgrading; the SQL plugin does not replay its queue.

Existing sync metadata stays in the database for compatibility. Queries exclude
legacy tombstones; new deletes use SQL DELETE with PostgreSQL foreign key cascades.
No destructive schema migration runs at startup.

Build with `cd frontend && npm install && npm run build`. Deploy the complete
`dist` directory. Application files are cached for offline opening, but loading
data after a reload requires connectivity. Run `npm run test:sync` in `frontend`
to verify writes, subscriptions, and cascading membership deletion.

## Pros

- a relational database schema!
- real-time!
- parameterized SQL writes
- extensive use of observables, ideal for all types of reactive frameworks (React, Vue, etc.)

## Cons

- no autoincremented ids, only uuids (v7)
- writes require connectivity
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
