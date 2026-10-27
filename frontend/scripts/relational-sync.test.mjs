import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { electricSqlClientPlugin } from '@jcbuisson/express-x-plugins/electric-sql-client'
import { electricSqlServerPlugin } from '@jcbuisson/express-x-plugins/electric-sql-server'
import { tables, statements } from '../../backend/src/sql.js'

test('SQL writes, live rows, legacy tombstones and cascading membership deletion', async t => {
   const db = new PGlite()
   const vite = await createServer({ configFile: false,
      root: fileURLToPath(new URL('..', import.meta.url)),
      server: { middlewareMode: true, hmr: false, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
   })
   t.after(async () => { await vite.close(); await db.close() })
   await db.exec(`
      CREATE TABLE "user" (uid TEXT PRIMARY KEY, firstname TEXT, lastname TEXT, email TEXT UNIQUE, deleted BOOLEAN DEFAULT false);
      CREATE TABLE "group" (uid TEXT PRIMARY KEY, name TEXT UNIQUE, deleted BOOLEAN DEFAULT false);
      CREATE TABLE user_group_relation (uid TEXT PRIMARY KEY,
         user_uid TEXT REFERENCES "user"(uid) ON DELETE CASCADE,
         group_uid TEXT REFERENCES "group"(uid) ON DELETE CASCADE,
         deleted BOOLEAN DEFAULT false, UNIQUE(user_uid, group_uid));
   `)
   let service, emit, stopped = 0
   electricSqlServerPlugin({ createService(name, methods) { service = methods }, get() {} }, db, {
      tables, statements, authorize: () => true,
   })
   const app = { service: () => service }
   electricSqlClientPlugin(app, {
      ShapeStream: class { unsubscribeAll() { stopped++ } },
      Shape: class { subscribe(callback) { emit = callback; return () => {} } },
   })
   t.after(() => app.sql.dispose())
   const { default: createModel } = await vite.ssrLoadModule('/src/use/createSqlModel.ts')
   const users = createModel(app, 'user'), groups = createModel(app, 'group')
   const relations = createModel(app, 'user_group_relation')
   const user = await users.create({ email: "O'Brien@example.com" })
   const group = await groups.create({ name: 'Team' })
   await relations.create({ user_uid: user.uid, group_uid: group.uid })
   assert.equal((await relations.findMany({ user_uid: user.uid })).length, 1)
   await users.update(user.uid, { firstname: 'Alice' })
   assert.equal((await users.findUnique({ uid: user.uid })).firstname, 'Alice')
   await assert.rejects(users.update(user.uid, { unexpected: 'value' }), /Unknown/)
   await assert.rejects(app.sql.query('arbitrary SQL'), /unknown SQL statement/)
   let rows
   const subscription = users.getObservable({ uid: user.uid }).subscribe(value => { rows = value })
   emit({ rows: await users.findMany() })
   assert.equal(rows[0].email, "O'Brien@example.com")
   subscription.unsubscribe()
   assert.equal(stopped, 1)
   await groups.remove(group.uid)
   assert.deepEqual(await relations.findMany(), [])
   assert.ok(await users.findUnique({ uid: user.uid }))
   await db.query('UPDATE "user" SET deleted = true WHERE uid = $1', [user.uid])
   assert.deepEqual(await users.findMany(), [])
})
