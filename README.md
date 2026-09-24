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


### Sync mode

The backend enables `sync: true` and prepares the sync schema before listening.
Startup creates `electric_mutation_cursor`, the shared version sequence, and
`version`/`deleted` columns on the three application tables. Existing data is
preserved. Prisma also describes these columns and the cursor table.

The frontend prepares a persistent PGlite database in IndexedDB before mounting.
All three models read and write locally; queued writes are retried and confirmed
through Electric. Tabs share this database, and only the PGlite leader tab runs
Electric subscriptions and mutation retries. Another tab takes over when it closes.
This follows PGlite's [multi-tab worker setup](https://pglite.dev/docs/multi-tab-worker).

Deletes retain versioned tombstones. Deleted users/groups release their unique
email/name, and deleted relations clear their nullable foreign keys so the same
membership can be added again. Continue explicitly deleting memberships when
deleting a user or group: soft deletes do not trigger PostgreSQL cascades.

Production builds precache PGlite's WASM and database assets for offline reloads.
The development server does not enable the service worker, so a fully offline
reload should be tested using a production build. Keep browser storage to preserve
pending edits and the client identity; clearing it discards unsent changes.


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

## Alternatives

- yjs permet de partager un ensemble de valeurs entre plusieurs participants, en utilisant l'algorithme xxx.
Idéal pour les applis collaboratives, mais mal utilisable si la source de vérité est une BD centralisée
- CouchDB / PouchDB + replication
C'estdu NoSQL non structuré. MongoDB a des schémas, mais pas de protocole de réplication
- ElectricSQL : très prometteur, mais pas encore stable



## Under the hood

- Les clients ont des caches dénormalisés pour chaque table/modèle
- Ces caches permettent toutes les opérations relationnelles : accès aux objets, aux listes, jointures entre modèles, etc.
- Les clés de ces caches sont des uid, créés explicitement par les clients, pour ne pas avoir de conflit entre les identifiants créés offline par différents clients
- on utilise des uuidv7 (croissants) pour améliorer les performances des indexes de la base de données
- Toutes les opérations sont effectuées, d’abord sur ces caches (optimistic updates), puis envoyées à la base de données
- Les clients doivent expliciter le périmètre de leur synchronisation. Ils ne veulent pas être synchronisés avec toute la BD, seulement avec la partie qui les concerne. Ils le font en précisant les clauses ‘where’ des requêtes de base de données pour les données qui les concernent.
- Les opérations de base de données donnent lieu à l’envoi d’événements vers les clients, qui peuvent mettre à jour leurs caches en temps-réel. Grace à ces mises à jour en continu, un client qui part d’un état synchronisé avec le serveur, reste synchrone tant qu’il n’y a pas de déconnexion, quelles que soient les opérations que lui ou les autres clients réalisent
- Le client peut donc toujours considérer que la source de vérité est le contenu de ses caches

- À chaque reconnexion (y compris au démarrage), pour chaque table, et pour chaque requête `where`, le client demande une synchronisation au serveur
- Le service de synchronisation reçoit :
    - La requête ‘where’
    - Les clés/valeurs des caches du client associées à la requête
    - La date de ‘cutoff’ (dernière déconnexion)
- Le service de synchronisation :
    - Calcule les couples clé/valeur de la base de données associés à la requête ‘where’
    - Compare avec ceux reçus du client, relativement à la date de cutoff
    - Il réalise dans la base de données les changements nécessaires
    - Il renvoie au client les changements nécessaires de son cache
- A l’issue de la synchronisation, le serveur et le client sont dans le même état du point de vue des valeurs relatives à la requête ‘where’

- Dans le cas de relations many-many, les tables intermédiaires doivent être explicites et les caches et modèles associés doivent être également explicitement synchronisés 

- Lorsqu’un client supprime une donnée lorsqu’il est offline, il la marque avec deleted_at=now sans la supprimer du cache,
sinon le serveur ne pourrait pas savoir que le client a demandé à la supprimer (est-ce important ? À vérifier)
