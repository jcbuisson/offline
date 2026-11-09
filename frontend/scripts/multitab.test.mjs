import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { storageForRemote } from '../src/pgcouchStorage.mjs'

async function attachProbe(page, workerPath, workerName) {
   await page.evaluate(({ path, name }) => {
      // Attach a test port to the same worker used by the UI.
      const worker = new SharedWorker(path, { type: 'module', name })
      window.testWorker = worker
      const pending = new Map()
      worker.port.onmessage = ({ data }) => {
         const request = pending.get(data.id)
         if (!request || data.type !== 'result') return
         clearTimeout(request.timer)
         pending.delete(data.id)
         if (data.error) request.reject(new Error(data.error.message))
         else request.resolve(data.value)
      }
      worker.port.start()
      window.syncRequest = extra => new Promise((resolve, reject) => {
         const id = crypto.randomUUID()
         const timer = setTimeout(() => { pending.delete(id); reject(new Error('Sync request timed out')) }, 15000)
         pending.set(id, { resolve, reject, timer })
         worker.port.postMessage({ id, ...extra })
      })
      window.modelCall = (model, method, args = []) => window.syncRequest({ type: 'call', model, method, args })
   }, { path: workerPath, name: workerName })
}

// Exercise the actual bundled SharedWorker, PGlite, PouchDB and Vue lists.
// Use a fresh browser profile and disable proxies so no production data is touched.
test('production tabs share offline data and survive closing the first tab', { timeout: 60000 }, async t => {
   let browser
   const server = await preview({
      preview: { host: '127.0.0.1', port: 0, proxy: {} },
      plugins: [{
         name: 'test-couchdb-route',
         configurePreviewServer(server) {
            server.middlewares.use('/couchdb/', (_req, res) => {
               res.setHeader('Content-Type', 'text/html')
               res.end('<title>CouchDB test upstream</title><p>CouchDB route reached</p>')
            })
         },
      }],
   })
   t.after(async () => {
      await browser?.close()
      await server.close()
   })
   browser = await chromium.launch({ headless: true })
   const context = await browser.newContext()
   const origin = `http://127.0.0.1:${server.httpServer.address().port}`
   const storage = await storageForRemote('/couchdb/offline', origin)
   const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
   const mainPath = html.match(/src="([^"]+\.js)"/)[1]
   const bundle = await readFile(new URL(`../dist${mainPath}`, import.meta.url), 'utf8')
   const workerPath = bundle.match(/\/assets\/pgcouch\.worker-[^" ]+\.js/)[0]
   const errors = []
   context.on('page', page => {
      page.setDefaultTimeout(15000)
      page.on('pageerror', error => errors.push(error.message))
   })
   const attach = page => attachProbe(page, workerPath, storage.worker)
   const first = await context.newPage()
   await first.goto(`${origin}/groups`)
   await attach(first)
   await first.evaluate(() => window.syncRequest({ type: 'network', args: [false] }))
   await first.evaluate(() => window.modelCall('group', 'create', [{ uid: 'team', name: 'Shared team' }]))
   await first.getByText('Shared team', { exact: true }).waitFor()
   await first.evaluate(() => navigator.serviceWorker.ready.then(() => true))

   const second = await context.newPage()
   await second.goto(`${origin}/groups`)
   await second.getByText('Shared team', { exact: true }).waitFor()
   await attach(second)
   await context.setOffline(true)
   await second.evaluate(() => window.modelCall('group', 'update', ['team', { name: 'Offline edit' }]))
   await first.getByText('Offline edit', { exact: true }).waitFor()
   await second.getByText('Offline edit', { exact: true }).waitFor()

   await first.close()
   await second.evaluate(() => window.modelCall('group', 'update', ['team', { name: 'First tab closed' }]))
   await second.getByText('First tab closed', { exact: true }).waitFor()
   assert.equal((await second.evaluate(() => window.modelCall('group', 'getStatus'))).pending, 3)
   await second.evaluate(() => window.modelCall('user', 'create', [{
      uid: 'member', firstname: 'Offline', lastname: 'Member', email: 'tab@example.com',
   }]))
   await second.getByText('Utilisateurs', { exact: true }).first().click()
   await second.getByText('Member Offline', { exact: true }).waitFor()
   await second.reload()
   await second.getByText('Member Offline', { exact: true }).waitFor()
   await attach(second)
   assert.equal((await second.evaluate(() => window.modelCall('user', 'getStatus'))).pending, 4)
   assert.equal(await second.evaluate(() => Boolean(navigator.serviceWorker.controller)), true)
   await context.setOffline(false)
   await second.goto(`${origin}/couchdb/_utils/`)
   await second.getByText('CouchDB route reached', { exact: true }).waitFor()
   assert.equal(new URL(second.url()).pathname, '/couchdb/_utils/')
   assert.deepEqual(errors, [])
   await context.close()
})

test('switching remote databases isolates stores and switching back preserves pending edits', { timeout: 120000 }, async t => {
   const alternate = await mkdtemp(join(tmpdir(), 'offline-namespace-'))
   let browser, server
   t.after(async () => {
      await browser?.close()
      await server?.close()
      await rm(alternate, { recursive: true, force: true })
   })
   await build({
      logLevel: 'error',
      define: { 'import.meta.env.VITE_COUCH_DATABASE_URL': JSON.stringify('/couchdb/offline-v3') },
      build: { outDir: alternate, emptyOutDir: true },
   })
   const original = new URL('../dist', import.meta.url).pathname
   const start = outDir => preview({
      logLevel: 'error', build: { outDir },
      preview: { host: '127.0.0.1', port, strictPort: true, proxy: {} },
   })
   let port = 0
   server = await start(original)
   port = server.httpServer.address().port
   const origin = `http://127.0.0.1:${port}`
   browser = await chromium.launch({ headless: true })
   // Block service workers to simulate deploying new builds at the same origin
   // while retaining exactly the same browser IndexedDB profile.
   const context = await browser.newContext({ serviceWorkers: 'block' })
   async function open(outDir, remote) {
      const html = await readFile(join(outDir, 'index.html'), 'utf8')
      const mainPath = html.match(/src="([^"]+\.js)"/)[1]
      const bundle = await readFile(join(outDir, mainPath), 'utf8')
      const workerPath = bundle.match(/\/assets\/pgcouch\.worker-[^" ]+\.js/)[0]
      const storage = await storageForRemote(remote, origin)
      const page = await context.newPage()
      page.setDefaultTimeout(20000)
      await page.goto(`${origin}/groups`)
      await attachProbe(page, workerPath, storage.worker)
      await page.evaluate(() => window.syncRequest({ type: 'network', args: [false] }))
      return { page, storage }
   }
   let { page, storage: firstStorage } = await open(original, '/couchdb/offline')
   await page.evaluate(() => window.modelCall('group', 'create', [{ uid: 'first', name: 'Original database only' }]))
   await page.getByText('Original database only', { exact: true }).waitFor()
   await page.close()
   await server.close()

   server = await start(alternate)
   let secondStorage
   ;({ page, storage: secondStorage } = await open(alternate, '/couchdb/offline-v3'))
   assert.deepEqual(await page.evaluate(() => window.modelCall('group', 'findMany')), [])
   assert.equal((await page.evaluate(() => window.modelCall('group', 'getStatus'))).pending, 0)
   await page.evaluate(() => window.modelCall('group', 'create', [{ uid: 'second', name: 'New database only' }]))
   await page.getByText('New database only', { exact: true }).waitFor()
   const databases = await page.evaluate(() => indexedDB.databases())
   for (const storage of [firstStorage, secondStorage]) {
      assert.ok(databases.some(db => db.name === storage.relational.replace('idb://', '/pglite/')))
      assert.ok(databases.some(db => db.name === `_pouch_${storage.transactions}`))
   }
   await page.close()
   await server.close()

   server = await start(original)
   ;({ page } = await open(original, '/couchdb/offline'))
   await page.getByText('Original database only', { exact: true }).waitFor()
   assert.deepEqual((await page.evaluate(() => window.modelCall('group', 'findMany'))).map(row => row.uid), ['first'])
   assert.equal((await page.evaluate(() => window.modelCall('group', 'getStatus'))).pending, 1)
   await context.close()
})
