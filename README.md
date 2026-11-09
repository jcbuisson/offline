# Offline — PGCouch

Local-first users, groups and memberships using express-x-plugins 5.4.1 PGCouch.
PostgreSQL is authoritative; PGlite serves local queries and durable offline
transactions; PouchDB/CouchDB replicate proposals and server decisions.

## Setup

### Prerequisites and dependencies

Use Node.js 22.18+ (or Node.js 24+) and npm. The backend runs TypeScript from
its generated Prisma client using Node's type stripping. You also need a running
PostgreSQL server, the `psql` and `createdb` commands, and Docker with Compose v2
for CouchDB. Use a browser with IndexedDB and Web Locks on localhost or HTTPS.

Run these commands from the repository root:

```sh
npm --prefix backend install
npm --prefix frontend install
```

### PostgreSQL and environment

For a fresh local installation, create the database using your local PostgreSQL
account (adjust the connection URL for your username and password):

```sh
createdb offline
```

Create or update `backend/.env` with your own values:

```dotenv
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/offline
PORT=3000
COUCHDB_USER=offline-admin
COUCHDB_PASSWORD=CHANGE_ME_ADMIN_PASSWORD
COUCH_DATABASE_URL=http://offline-server:CHANGE_ME_SERVER_PASSWORD@localhost:5984/offline
```

`COUCHDB_USER` and `COUCHDB_PASSWORD` provision the CouchDB administrator;
`COUCH_DATABASE_URL` uses a separate application account created below.
URL-encode special characters in credentials embedded in URLs. Keep `.env` local.
The frontend needs no environment file for the default local proxy setup.

Export the same PostgreSQL URL in your shell before applying the schema;
`psql` does not automatically load `backend/.env`:

```sh
export DATABASE_URL='postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/offline'
```

Before migrating an existing Electric installation, synchronize all pending
browser edits, stop the old backend/Electric, and back up PostgreSQL. The new
client uses separate IndexedDB databases; old unsent edits are not imported.
Apply the schema to a new or existing database:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/pgcouch.sql
```

This preserves active rows, removes already deleted Electric tombstones, drops
Electric's per-row sync columns, and makes membership foreign keys deferrable.
Run it once during migration, before starting PGCouch. Prisma describes business
tables; after future Prisma schema pushes, ensure foreign keys remain deferrable.
The plugin creates its own receipt/outbox tables at startup.

### CouchDB and replication accounts

Start CouchDB from the repository root. Explicitly load the backend environment
so Compose receives the administrator credentials:

```sh
docker compose --env-file backend/.env -f backend/docker-compose.yml up -d --wait
```

Provision the replication database once, using an admin URL including its name:

```sh
cd backend
COUCH_ADMIN_DATABASE_URL=http://offline-admin:CHANGE_ME_ADMIN_PASSWORD@localhost:5984/offline npm run pgcouch:setup
```

Open CouchDB's Fauxton interface at <http://localhost:5984/_utils/> and sign in
with the administrator credentials. Complete single-node setup if prompted.
In the `_users` database, create these documents, replacing the passwords:

```json
{"_id":"org.couchdb.user:offline-server","name":"offline-server","password":"CHANGE_ME_SERVER_PASSWORD","roles":["pgcouch-server"],"type":"user"}
```

```json
{"_id":"org.couchdb.user:offline-browser","name":"offline-browser","password":"CHANGE_ME_BROWSER_PASSWORD","roles":[],"type":"user"}
```

In the `offline` database's Permissions settings, add `offline-server` and
`offline-browser` as member names. The resulting database `_security` should be:

```json
{"admins":{"names":[],"roles":[]},"members":{"names":["offline-server","offline-browser"],"roles":[]}}
```

Before enabling replication, configure these memberships and application accounts. Give the backend account the `pgcouch-server` role and
normal browser users membership without that role. The installed validator makes
protocol documents immutable and restricts server decisions to server accounts.
All members can read the entire dataset. This demo has a shared read/write scope;
server authorization validates user emails for both socket and replicated writes.

Set `COUCH_DATABASE_URL` in `backend/.env` to the authenticated server account URL.
The browser defaults to `/couchdb/offline`; configure CouchDB cookie authentication
or your authenticated reverse proxy there. Never put server/admin credentials in
frontend environment variables. `VITE_COUCH_DATABASE_URL` can override the URL.
Vite proxies `/couchdb/` to localhost:5984. Production needs the equivalent proxy
and the existing `/offline-socket-io/` WebSocket route. No Electric service or
logical PostgreSQL replication configuration is needed.

For the same CouchDB upstream used by `frontend/vite.config.js`, add this inside
the production HTTPS Nginx server block (outside `location /`):

```nginx
location ^~ /couchdb/ {
    proxy_pass https://couchdb.jcbuisson.dev/;
    proxy_ssl_server_name on;
    proxy_set_header Host couchdb.jcbuisson.dev;
    proxy_http_version 1.1;
    proxy_cookie_path / /couchdb/;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 120s;
}
```

Use the actual CouchDB upstream if it differs. The trailing slash on `proxy_pass`
strips `/couchdb/` before forwarding. Test with `sudo nginx -t`, then reload with
`sudo systemctl reload nginx`. `/couchdb/_session` must return CouchDB JSON rather
than the app's HTML. CouchDB navigation URLs must also bypass the service worker's
app-shell fallback; rebuild and deploy the frontend after changing that rule.

### Automatic CouchDB authentication in production

For this shared demo, Nginx can authenticate replication requests as
`offline-browser`, so visitors do not need to sign in to Fauxton. Use the browser
account created above: it must be a database member with no `_admin` or
`pgcouch-server` role. Keep the backend's server account separate.

Generate the browser account's Basic authentication value on the server:

```sh
printf '%s' 'offline-browser:CHANGE_ME_BROWSER_PASSWORD' | base64 | tr -d '\n'
```

Replace the password with the account's actual password. Treat the resulting
Base64 value as a password and keep it in the server's Nginx configuration, never
in frontend code or `VITE_` variables.

Add these locations inside the production HTTPS `server` block, alongside the
general `/couchdb/` proxy above. The longer database-specific location supplies
automatic credentials only for the intended database, leaving Fauxton and other
CouchDB endpoints on their normal authentication flow:

```nginx
location = /couchdb/offline {
    return 307 /couchdb/offline/;
}

location ^~ /couchdb/offline/ {
    proxy_pass https://couchdb.jcbuisson.dev/offline/;
    proxy_ssl_server_name on;
    proxy_set_header Host couchdb.jcbuisson.dev;
    proxy_http_version 1.1;

    proxy_set_header Authorization "Basic REPLACE_WITH_BASE64_VALUE";
    proxy_set_header Cookie "";

    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 120s;
}
```

The `Authorization` header authenticates upstream requests. Clearing `Cookie`
prevents an existing CouchDB session from overriding the shared account. Use your
actual upstream host, and replace `offline` consistently in both locations and
`proxy_pass` if your database is named differently, for example `offline-v3`.
Do not add these shared credentials to the general `/couchdb/` location.

Keep the frontend URL on the app's origin and free of credentials:

```dotenv
VITE_COUCH_DATABASE_URL=/couchdb/offline
```

Apply the Nginx configuration:

```sh
sudo nginx -t && sudo service nginx reload
```

If you changed the frontend environment variable, rebuild and deploy
`frontend/dist`. Verify access without a browser session:

```sh
curl -i https://offline.jcbuisson.dev/couchdb/offline/
```

Expect HTTP 200 and CouchDB database JSON, rather than HTTP 401 or the app's HTML.
A fresh private browser window should then synchronize without a Fauxton login.
`/couchdb/_session` remains unauthenticated unless you explicitly sign in, because
automatic authentication is scoped to the database route.

Every visitor using this proxy receives the shared account's read/write access.
For individual permissions, authenticate users in the application and derive
CouchDB access from their authenticated sessions instead of using a shared
account. The local Vite proxy still uses the cookie login described below.

### Compress static assets for faster first loads

A fresh browser profile or private session must download and initialize PGlite
before the lists can load. Its WebAssembly runtime and initial database together
are roughly 16 MB uncompressed. Enable compression for the static assets by
adding this location inside the production HTTPS `server` block:

```nginx
location ^~ /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types application/wasm application/octet-stream
               application/javascript text/javascript text/css application/json;
}
```

Include `application/octet-stream`: this is the content type normally served for
PGlite's `.data` file. The location inherits the frontend `dist` root from the
server block. After `sudo nginx -t && sudo service nginx reload`, check a current
`.wasm` and `.data` asset URL from the browser's Network panel:

```sh
curl -sSI -H 'Accept-Encoding: gzip' https://offline.jcbuisson.dev/assets/ACTUAL_ASSET_FILENAME
```

Expect `Content-Encoding: gzip` and `Vary: Accept-Encoding`. Asset filenames
change with builds; use the deployed names. Compression reduces transfer size,
but a fresh session still needs time for WebAssembly initialization, local
database creation and the first CouchDB replication.

### Run locally

From the repository root, start each process in a separate terminal:

```sh
npm --prefix backend run dev
```

```sh
npm --prefix frontend run dev
```

The backend listens on <http://localhost:3000>; the app runs at
<http://localhost:8080>. With Vite running, open
<http://localhost:8080/couchdb/_utils/> and sign in as `offline-browser` to establish
a CouchDB session on the app's origin. Then open or reload the app. Signing in
on port 5984 alone does not establish a session through every proxy setup.

Create a user or group and check that replication succeeds. Use the disconnect
control to queue an edit locally, then reconnect and confirm it synchronizes.
If replication returns 401 or 403, check the browser session, database membership,
and the backend account's `pgcouch-server` role. Keep the backend on port 3000
unless you also update the WebSocket proxy in `frontend/vite.config.js`.

To stop CouchDB without deleting its persistent data:

```sh
docker compose --env-file backend/.env -f backend/docker-compose.yml stop
```

## Offline behavior and deployment

The app initializes the PGlite and PouchDB stores in a SharedWorker. All tabs
share its database, transaction queue, replication feed and offline switch;
queries stream updates back to each tab. Both local stores, the worker and its
Web Lock are namespaced by the remote database URL (host and path, excluding
credentials). Changing `VITE_COUCH_DATABASE_URL` and rebuilding selects separate
storage; switching back resumes that database's pending edits. Existing stores
with the old fixed names are retained but are never automatically imported into
a remote database. Close all old app tabs when first deploying this version.
The browser must support SharedWorker. Browser
storage must be retained to preserve unsent edits. The disconnect control pauses
Couch replication; local transactions still commit and queue.

Run the sync checks and production build from the repository root:

```sh
npm --prefix frontend run test:sync
npm --prefix frontend run build
```

The production multi-tab browser regression check uses Playwright Chromium:

```sh
cd frontend
npx playwright install chromium webkit
npm run test:tabs
```

Browser checks cover Chromium and WebKit with an iPhone profile. The transport
uses PouchDB's `indexeddb` adapter in a separate namespaced store for Safari
compatibility. On upgrade, the app resets only the transport's change cursor;
cached relational data and pending edits remain in PGlite and are replayed.
Worker requests wait for an explicit ready message. If startup stalls for a
minute, the app stops its spinners and offers a retry without clearing storage.

Deploy the complete
`frontend/dist` output. Production builds precache PGlite assets; test offline
reloads with a production build because development disables the service worker.

PGCouch sends a complete snapshot of all configured tables with each decision,
so this demo is intended for bounded datasets. All replicated writes must go
through PGCouch; external SQL writes are not automatically captured. Do not prune
Couch protocol documents or PostgreSQL receipts, which provide ordering and
idempotency. Transactions rejected by the server are rolled back locally and
remain counted in the status banner; users can submit a corrected edit.

If old snapshots and decisions no longer reconstruct the current PostgreSQL
dataset (for example, after direct SQL edits), publish a full recovery checkpoint
from the production backend directory:

```sh
npm run pgcouch:checkpoint
```

This uses `DATABASE_URL` and `COUCH_DATABASE_URL` from the backend environment.
It appends a snapshot of the current PostgreSQL rows at a new sequence and leaves
the application tables and existing sync documents intact. Browsers can resume
from that checkpoint and replay their pending local edits. Close and reopen app
tabs afterward to clear old error banners. Normal writes should go through the
PGCouch services so subsequent decisions describe all database changes.
