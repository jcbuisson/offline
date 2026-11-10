import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import PouchDB from 'pouchdb'
import memory from 'pouchdb-adapter-memory'
import { pgcouchClientPlugin } from '@jcbuisson/express-x-plugins/pgcouch-client'
import { pgcouchServerPlugin } from '@jcbuisson/express-x-plugins/pgcouch-server'
import models from '../../backend/src/syncModels.js'
import { validateUserMutation } from '../../backend/src/validateUser.js'
import { restoreMissingBootstrap } from '../../backend/src/restoreBootstrap.js'
import { publishCheckpoint } from '../../backend/src/publishCheckpoint.js'
import { recoverSyncHistory } from '../../backend/src/recoverSyncHistory.js'
PouchDB.plugin(memory)

test('recovery keeps production rows, archives conflicting decisions and resumes pending edits', async t => {
   const server = new PGlite(), local = new PGlite()
   const remote = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const couch = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const schema = await readFile(new URL('../src/local-schema.sql', import.meta.url), 'utf8')
   await server.exec(schema); await local.exec(schema)
   await server.query('INSERT INTO "group" (uid, name) VALUES ($1, $2)', ['deleted', 'Delete me'])
   let sync = pgcouchServerPlugin({ createService() {} }, server, models, { couch: remote })
   const app = {}
   t.after(async () => {
      await app.disposePGCouchSync(); await sync.dispose()
      await Promise.all([server.close(), local.close(), remote.destroy(), couch.destroy()])
   })
   await sync.ready
   const id = `transaction:${crypto.randomUUID()}`
   const rejected = { _id: `result:${id.slice(12)}`, type: 'result', transactionId: id,
      status: 'rejected', sequence: '7', changes: [], error: { code: '23503', message: 'Rejected' } }
   await remote.put(rejected)
   await sync.submit([{ table: 'group', action: 'delete', id: 'deleted' }], {}, id)
   await sync.dispose()
   const original = (await server.query('SELECT decision FROM pgcouch_receipts WHERE id = $1', [id])).rows[0].decision
   const foreignId = `transaction:${crypto.randomUUID()}`
   const foreign = { _id: foreignId, type: 'transaction', status: 'pending',
      operations: [{ table: 'group', action: 'insert', id: 'foreign', data: { name: 'Foreign only' } }] }
   await remote.put(foreign)
   await remote.put({ _id: `result:${foreignId.slice(12)}`, type: 'result', transactionId: foreignId,
      status: 'accepted', sequence: '12', changes: [] })
   pgcouchClientPlugin(app, { models, localDb: local, couch, autoStart: false })
   await app.pgcouchReady
   await remote.replicate.to(couch)
   const groups = app.createPGCouchModel('group')
   await groups.flushQueue()
   await groups.create({ uid: 'pending', name: 'Offline pending' })
   await assert.rejects(recoverSyncHistory(server, {
      allDocs: options => remote.allDocs(options),
      put: async () => { throw new Error('Publication unavailable') },
   }), /Publication unavailable/)
   assert.equal((await server.query('SELECT published FROM pgcouch_receipts WHERE id = $1', [id])).rows[0].published, false)
   const result = await recoverSyncHistory(server, remote)
   assert.equal(result.checkpoint.sequence, '14')
   assert.equal(result.superseded, 1)
   assert.equal(result.imported, 1)
   assert.deepEqual((await server.query('SELECT decision FROM pgcouch_receipts WHERE id = $1', [id])).rows[0].decision, original)
   assert.equal((await server.query('SELECT * FROM pgcouch_recovery_audit')).rows.length, 1)
   const { _rev, ...unchanged } = await remote.get(rejected._id)
   assert.deepEqual(unchanged, rejected)
   await remote.replicate.to(couch); await groups.flushQueue()
   assert.deepEqual((await groups.findMany()).map(row => row.uid), ['pending'])
   await couch.replicate.to(remote)
   const errors = []
   sync = pgcouchServerPlugin({ createService() {} }, server, models, { couch: remote, onError: error => errors.push(error) })
   await sync.ready; await sync.flushQueue()
   await remote.replicate.to(couch); await groups.flushQueue()
   assert.equal((await groups.getStatus()).pending, 0)
   assert.deepEqual((await server.query('SELECT uid FROM "group" ORDER BY uid')).rows, [{ uid: 'pending' }])
   assert.deepEqual(errors, [])
})

test('an offline group deletion and cascaded memberships publish idempotently after reconnect', async t => {
   const server = new PGlite(), local = new PGlite()
   const remote = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const couch = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const schema = await readFile(new URL('../src/local-schema.sql', import.meta.url), 'utf8')
   await server.exec(schema); await local.exec(schema)
   await server.exec(`INSERT INTO "user" (uid, email) VALUES ('member', 'member@example.com');
      INSERT INTO "group" (uid, name) VALUES ('team', 'Team');
      INSERT INTO user_group_relation (uid, user_uid, group_uid) VALUES ('membership', 'member', 'team');`)
   const errors = [], app = {}
   const sync = pgcouchServerPlugin({ createService() {} }, server, models, { couch: remote, onError: error => errors.push(error) })
   t.after(async () => {
      await app.disposePGCouchSync(); await sync.dispose()
      await Promise.all([server.close(), local.close(), remote.destroy(), couch.destroy()])
   })
   await sync.ready
   pgcouchClientPlugin(app, { models, localDb: local, couch, autoStart: false, onError: error => errors.push(error) })
   await app.pgcouchReady
   await remote.replicate.to(couch)
   const groups = app.createPGCouchModel('group')
   await groups.flushQueue()
   await groups.delete('team')
   assert.equal((await groups.getStatus()).pending, 1)
   await couch.replicate.to(remote)
   await sync.flushQueue()
   // Simulate a crash after CouchDB accepted the decision but before the SQL
   // outbox marked it published. Retrying must compare equal to that decision.
   await server.query("UPDATE pgcouch_receipts SET published = false WHERE id <> 'bootstrap'")
   await sync.flushQueue()
   await remote.replicate.to(couch)
   await groups.flushQueue()
   assert.equal((await groups.getStatus()).pending, 0)
   assert.deepEqual(await groups.findMany(), [])
   assert.deepEqual((await server.query('SELECT * FROM user_group_relation')).rows, [])
   assert.deepEqual(await app.createPGCouchModel('user_group_relation').findMany(), [])
   assert.deepEqual(errors, [])
})

test('an authoritative checkpoint recovers a browser blocked by incompatible group history', async t => {
   const server = new PGlite(), local = new PGlite()
   const remote = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const couch = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const schema = await readFile(new URL('../src/local-schema.sql', import.meta.url), 'utf8')
   await server.exec(schema); await local.exec(schema)
   await server.query('INSERT INTO "group" (uid, name) VALUES ($1, $2)', ['old', 'Team'])
   const services = new Map(), app = {}, errors = []
   const sync = pgcouchServerPlugin({ createService: (name, methods) => services.set(name, methods) }, server, models, { couch: remote })
   t.after(async () => {
      await app.disposePGCouchSync(); await sync.dispose()
      await Promise.all([server.close(), local.close(), remote.destroy(), couch.destroy()])
   })
   await sync.ready
   // An out-of-band edit leaves an old bootstrap incompatible with later writes.
   await server.query('DELETE FROM "group"')
   await services.get('group').create({ uid: 'current', name: 'Team' })
   pgcouchClientPlugin(app, { models, localDb: local, couch, autoStart: false, onError: error => errors.push(error) })
   await app.pgcouchReady
   await remote.replicate.to(couch)
   const groups = app.createPGCouchModel('group')
   await assert.rejects(groups.flushQueue(), error => error.code === '23505')
   const users = app.createPGCouchModel('user')
   await users.create({ uid: 'queued', email: 'queued@example.com' })
   const before = await remote.allDocs()
   const checkpoint = await publishCheckpoint(server, remote)
   assert.equal(checkpoint.sequence, '2')
   await remote.replicate.to(couch)
   await groups.flushQueue()
   assert.deepEqual((await groups.findMany()).map(row => row.uid), ['current'])
   assert.equal((await users.findMany())[0].uid, 'queued')
   assert.equal((await users.getStatus()).pending, 1)
   assert.equal((await remote.allDocs()).total_rows, before.total_rows + 1)
   // Later server decisions retain a contiguous sequence and continue syncing.
   await services.get('group').update('current', { name: 'Updated' })
   await remote.replicate.to(couch); await groups.flushQueue()
   assert.equal((await groups.findMany())[0].name, 'Updated')
})

test('a replacement CouchDB database restores the original bootstrap for fresh browsers', async t => {
   const server = new PGlite(), local = new PGlite()
   const original = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const replacement = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const couch = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const app = {}, services = new Map()
   const schema = await readFile(new URL('../src/local-schema.sql', import.meta.url), 'utf8')
   await server.exec(schema); await local.exec(schema)
   await server.query('INSERT INTO "user" (uid, email) VALUES ($1, $2)', ['initial', 'initial@example.com'])
   let sync = pgcouchServerPlugin({ createService: (name, methods) => services.set(name, methods) }, server, models, { couch: original })
   let clientStarted = false
   t.after(async () => {
      if (clientStarted) await app.disposePGCouchSync()
      await sync.dispose()
      await Promise.all([server.close(), local.close(), original.destroy(), replacement.destroy(), couch.destroy()])
   })
   await sync.ready
   const bootstrap = (await server.query("SELECT decision FROM pgcouch_receipts WHERE id = 'bootstrap'")).rows[0].decision
   await services.get('group').create({ uid: 'team', name: 'After bootstrap' })
   await sync.dispose()
   sync = pgcouchServerPlugin({ createService() {} }, server, models, { couch: replacement })
   await sync.ready
   // Reproduce history copied without its already-published bootstrap.
   const { rows } = await original.allDocs({ include_docs: true, startkey: 'result:', endkey: 'result:\uffff' })
   for (const { doc } of rows) if (doc._id !== 'result:bootstrap') {
      const { _rev, ...body } = doc
      await replacement.put(body)
   }
   await replacement.replicate.to(couch)
   pgcouchClientPlugin(app, { models, localDb: local, couch, autoStart: false })
   clientStarted = true
   await app.pgcouchReady
   const users = app.createPGCouchModel('user'), groups = app.createPGCouchModel('group')
   assert.deepEqual(await users.findMany(), [])
   assert.deepEqual(await groups.findMany(), [])
   assert.equal(await restoreMissingBootstrap(sync, server, replacement), true)
   const { _rev, ...restored } = await replacement.get('result:bootstrap')
   assert.deepEqual(restored, bootstrap)
   await replacement.replicate.to(couch)
   await users.flushQueue()
   assert.equal((await users.findMany())[0].uid, 'initial')
   assert.equal((await groups.findMany())[0].uid, 'team')
   assert.equal(await restoreMissingBootstrap(sync, server, replacement), false)
})

test('offline replication, cascades, validation and atomic rollback', async t => {
   const server = new PGlite(), local = new PGlite()
   const couch = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const remote = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const schema = await readFile(new URL('../src/local-schema.sql', import.meta.url), 'utf8')
   await server.exec(schema); await local.exec(schema)
   const services = new Map()
   const sync = pgcouchServerPlugin({ createService: (name, methods) => services.set(name, methods) }, server, models, {
      couch: remote, retryMs: 60000,
      authorize(context, { modelName, action, args }) {
         if (modelName === 'user' && ['create', 'update'].includes(action)) {
            try { validateUserMutation({ args }, action) } catch { throw new TypeError('Invalid email') }
         }
         return true
      },
   })
   const app = {}, errors = []
   pgcouchClientPlugin(app, { models, localDb: local, couch, autoStart: false, onError: e => errors.push(e) })
   t.after(async () => {
      await app.disposePGCouchSync(); await sync.dispose()
      await Promise.all([local.close(), server.close(), couch.destroy(), remote.destroy()])
   })
   await sync.ready; await app.pgcouchReady
   const users = app.createPGCouchModel('user'), groups = app.createPGCouchModel('group'), relations = app.createPGCouchModel('user_group_relation')
   async function deliver() {
      await users.flushQueue(); await couch.replicate.to(remote)
      await sync.flushQueue(); await remote.replicate.to(couch); await users.flushQueue()
   }
   const user = await users.create({ email: 'member@example.com' })
   const group = await groups.create({ name: 'Team' })
   await relations.create({ user_uid: user.uid, group_uid: group.uid })
   assert.equal((await users.getStatus()).pending, 3)
   assert.equal((await server.query('SELECT * FROM "user"')).rows.length, 0)
   await deliver()
   assert.equal((await users.getStatus()).pending, 0)
   await groups.remove(group.uid)
   assert.deepEqual(await relations.findMany(), [])
   const other = await services.get('user').create({ email: 'other@example.com' })
   await services.get('user_group_relation').create({ user_uid: other.uid, group_uid: group.uid })
   await deliver()
   assert.deepEqual((await server.query('SELECT * FROM user_group_relation')).rows, [])
   await users.update(user.uid, { email: 'invalid' }); await deliver()
   assert.equal((await users.findUnique({ uid: user.uid })).email, 'member@example.com')
   assert.equal((await users.getStatus()).failed, 1)
   assert.equal(errors.length, 1)
   await services.get('group').create({ name: 'Unique' })
   await groups.create({ name: 'Unique' }); await deliver()
   assert.equal((await groups.findMany({ name: 'Unique' })).length, 1)
   assert.equal((await groups.getStatus()).failed, 2)
   await assert.rejects(app.pgcouchTransaction([
      { action: 'insert', table: 'group', id: 'rollback', data: { name: 'Rollback' } },
      { action: 'insert', table: 'user_group_relation', id: 'bad', data: { user_uid: user.uid, group_uid: 'missing' } },
   ]))
   assert.equal(await groups.findUnique({ uid: 'rollback' }), null)
})

test('migration preserves active Electric rows and prepares deferrable constraints', async t => {
   const db = new PGlite()
   t.after(() => db.close())
   await db.exec(await readFile(new URL('../src/local-schema.sql', import.meta.url), 'utf8'))
   for (const table of ['user', 'group', 'user_group_relation']) {
      await db.exec(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 1, ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false`)
   }
   await db.exec(`INSERT INTO "user" (uid, email) VALUES ('active', 'active@example.com');
      INSERT INTO "group" (uid, name, deleted) VALUES ('old', NULL, true);`)
   const migration = await readFile(new URL('../../backend/sql/pgcouch.sql', import.meta.url), 'utf8')
   await db.exec(migration)
   await db.exec(migration)
   assert.equal((await db.query('SELECT * FROM "user"')).rows[0].email, 'active@example.com')
   assert.deepEqual((await db.query('SELECT * FROM "group"')).rows, [])
   const constraints = (await db.query("SELECT condeferrable FROM pg_constraint WHERE conrelid = 'user_group_relation'::regclass AND contype = 'f'")).rows
   assert.equal(constraints.length, 2)
   assert.ok(constraints.every(row => row.condeferrable))
})

test('current snapshots without Electric metadata are visible in a fresh browser', async t => {
   const db = new PGlite()
   const couch = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const app = {}
   await db.exec(await readFile(new URL('../src/local-schema.sql', import.meta.url), 'utf8'))
   await couch.put({ _id: 'result:bootstrap', type: 'result', status: 'accepted', sequence: '0', snapshot: {
      user: [{ uid: 'active', email: 'active@example.com' }],
      group: [{ uid: 'team', name: 'Team' }],
      user_group_relation: [{ uid: 'membership', user_uid: 'active', group_uid: 'team' }],
   } })
   pgcouchClientPlugin(app, { models, localDb: db, couch, autoStart: false })
   t.after(async () => { await app.disposePGCouchSync(); await db.close(); await couch.destroy() })
   await app.pgcouchReady
   for (const { name } of models) {
      assert.equal((await app.createPGCouchModel(name).findMany({ deleted: false })).length, 1, name)
   }
})

test('legacy snapshots with Electric metadata load into the browser schema', async t => {
   const db = new PGlite()
   const couch = new PouchDB(crypto.randomUUID(), { adapter: 'memory' })
   const app = {}
   await db.exec(await readFile(new URL('../src/local-schema.sql', import.meta.url), 'utf8'))
   await couch.put({ _id: 'result:bootstrap', type: 'result', status: 'accepted', sequence: '0', snapshot: {
      user: [{ uid: 'active', email: 'active@example.com', deleted: false, version: 1 },
         { uid: 'deleted', email: 'deleted@example.com', deleted: true, version: 2 }],
      group: [{ uid: 'team', name: 'Team', deleted: false, version: 1 }],
      user_group_relation: [],
   } })
   pgcouchClientPlugin(app, { models, localDb: db, couch, autoStart: false })
   t.after(async () => { await app.disposePGCouchSync(); await db.close(); await couch.destroy() })
   await app.pgcouchReady
   const users = await app.createPGCouchModel('user').findMany({ deleted: false })
   assert.deepEqual(users.map(user => user.uid), ['active'])
   assert.equal((await app.createPGCouchModel('group').findMany({ deleted: false })).length, 1)
})
