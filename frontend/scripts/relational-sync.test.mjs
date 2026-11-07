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
PouchDB.plugin(memory)

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
