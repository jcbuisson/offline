import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, webkit, devices } from 'playwright'
import { build, preview } from 'vite'
import { storageForRemote } from '../src/pgcouchStorage.mjs'

async function attachProbe(page, workerPath, workerName) {
   await page.evaluate(({ path, name }) => {
      // Attach a test port to the same worker used by the UI.
      const worker = new SharedWorker(path, { type: 'module', name: `${name}:${path}` })
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
   await first.getByRole('status').filter({ hasText: 'en attente de validation par le serveur' }).waitFor()
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

test('spinners cover startup, database loading, saves and deletes and clear on failure', { timeout: 60000 }, async t => {
   let releaseScript, releaseDatabase
   const scriptGate = new Promise(resolve => { releaseScript = resolve })
   const databaseGate = new Promise(resolve => { releaseDatabase = resolve })
   let browser
   const server = await preview({
      logLevel: 'error', preview: { host: '127.0.0.1', port: 0, proxy: {} },
      plugins: [{ name: 'delayed-startup', configurePreviewServer(server) {
         server.middlewares.use((req, res, next) => {
            if (/^\/assets\/index-.*\.js$/.test(req.url)) { void scriptGate.then(() => next()); return }
            if (/\.wasm$/.test(req.url)) { void databaseGate.then(() => next()); return }
            if (req.url.startsWith('/couchdb/')) {
               res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
               res.end(JSON.stringify({ error: 'unauthorized', reason: 'Test authentication failure' }))
               return
            }
            next()
         })
      } }],
   })
   t.after(async () => { releaseScript(); releaseDatabase(); await browser?.close(); await server.close() })
   browser = await chromium.launch({ headless: true })
   const context = await browser.newContext({ serviceWorkers: 'block' })
   const page = await context.newPage()
   page.setDefaultTimeout(15000)
   const errors = []
   page.on('pageerror', error => errors.push(error.message))
   await page.addInitScript(() => {
      const post = MessagePort.prototype.postMessage
      MessagePort.prototype.postMessage = function(message, ...args) {
         if (message.type === 'call' && ['create', 'update', 'remove', 'delete'].includes(message.method)) {
            setTimeout(() => post.call(this, message, ...args), 700)
         } else return post.call(this, message, ...args)
      }
   })
   const origin = `http://127.0.0.1:${server.httpServer.address().port}`
   await page.goto(`${origin}/groups/create`, { waitUntil: 'commit' })
   await page.getByRole('status').filter({ hasText: 'Chargement de l’application' }).waitFor()
   releaseScript()
   await page.getByRole('status').filter({ hasText: 'Préparation des données' }).waitFor()
   await page.getByRole('status').filter({ hasText: 'Chargement des groupes' }).waitFor()
   releaseDatabase()
   await page.waitForFunction(() => !document.body.textContent.includes('Préparation des données'))
   await page.getByRole('alert').filter({ hasText: 'Connectez-vous à CouchDB' }).waitFor()
   await page.waitForFunction(() => !document.querySelector('[role="status"]'))

   await page.getByLabel('Nom', { exact: true }).fill('Spinner test')
   await page.getByRole('button', { name: 'Créer groupe' }).click()
   await page.locator('.v-btn--loading').waitFor()
   await page.getByRole('status').filter({ hasText: 'Enregistrement' }).first().waitFor()
   await page.waitForURL(/\/groups\/(?!create)[^/]+$/)
   await page.getByText('Spinner test', { exact: true }).waitFor()
   await page.waitForFunction(() => !document.body.textContent.includes('Enregistrement…'))

   await page.getByLabel('Nom', { exact: true }).fill('Updated spinner test')
   await page.getByRole('status').filter({ hasText: 'Enregistrement' }).first().waitFor()
   await page.getByText('Updated spinner test', { exact: true }).waitFor()
   await page.waitForFunction(() => !document.body.textContent.includes('Enregistrement…'))

   // Attempt a duplicate creation: rejected operations must stop their spinners.
   await page.goto(`${origin}/groups/create`)
   await page.getByLabel('Nom', { exact: true }).fill('Updated spinner test')
   await page.getByRole('button', { name: 'Créer groupe' }).click()
   await page.locator('.v-btn--loading').waitFor()
   await page.getByText('Erreur lors de la création...', { exact: true }).waitFor()
   await page.waitForFunction(() => !document.querySelector('.v-btn--loading'))
   assert.equal(await page.getByRole('button', { name: 'Créer groupe' }).isEnabled(), true)

   await page.locator('.v-list-item').filter({ hasText: 'Updated spinner test' }).getByRole('button').click()
   const confirm = page.locator('dialog').getByRole('button', { name: 'Supprimer', exact: true })
   await confirm.click()
   await page.locator('dialog .v-btn--loading').waitFor()
   await page.waitForFunction(() => !document.querySelector('dialog[open]'))
   await page.waitForFunction(() => !document.querySelector('.v-list-item'))
   assert.deepEqual(errors, [])
   await context.close()
})

test('WebKit with an iPhone profile initializes, loads lists and preserves offline edits on reload', { timeout: 60000 }, async t => {
   let browser
   const server = await preview({
      logLevel: 'error', preview: { host: '127.0.0.1', port: 0, proxy: {} },
      plugins: [{ name: 'unavailable-sync-for-offline-test', configurePreviewServer(server) {
         server.middlewares.use('/couchdb/', (_req, res) => {
            res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'unauthorized', reason: 'Test offline editing' }))
         })
      } }],
   })
   t.after(async () => { await browser?.close(); await server.close() })
   browser = await webkit.launch({ headless: true })
   const context = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' })
   const page = await context.newPage()
   page.setDefaultTimeout(20000)
   const errors = []
   page.on('pageerror', error => errors.push(error.message))
   const origin = `http://127.0.0.1:${server.httpServer.address().port}`
   await page.goto(`${origin}/groups`)
   await page.getByRole('alert').filter({ hasText: 'Connectez-vous à CouchDB' }).waitFor()
   await page.waitForFunction(() => !document.querySelector('[role="status"]'))
   const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
   const mainPath = html.match(/src="([^"]+\.js)"/)[1]
   const bundle = await readFile(new URL(`../dist${mainPath}`, import.meta.url), 'utf8')
   const workerPath = bundle.match(/\/assets\/pgcouch\.worker-[^" ]+\.js/)[0]
   const storage = await storageForRemote('/couchdb/offline', origin)
   await attachProbe(page, workerPath, storage.worker)
   await page.evaluate(() => window.modelCall('group', 'create', [{ uid: 'iphone', name: 'iPhone group' }]))
   await page.getByText('iPhone group', { exact: true }).waitFor()
   await page.reload()
   await page.getByText('iPhone group', { exact: true }).waitFor()
   await page.waitForFunction(() => !document.body.textContent.includes('Préparation des données'))
   await attachProbe(page, workerPath, storage.worker)
   assert.equal((await page.evaluate(() => window.modelCall('group', 'getStatus'))).pending, 1)
   assert.deepEqual(errors, [])
   await context.close()
})

test('stalled initialization stops its spinners and offers a non-destructive retry', { timeout: 30000 }, async t => {
   let release, browser
   const gate = new Promise(resolve => { release = resolve })
   const server = await preview({
      logLevel: 'error', preview: { host: '127.0.0.1', port: 0, proxy: {} },
      plugins: [{ name: 'stalled-database', configurePreviewServer(server) {
         server.middlewares.use((req, _res, next) => {
            if (/\.wasm$/.test(req.url)) { void gate.then(() => next()); return }
            next()
         })
      } }],
   })
   t.after(async () => { release(); await browser?.close(); await server.close() })
   browser = await chromium.launch({ headless: true })
   const context = await browser.newContext({ serviceWorkers: 'block' })
   const page = await context.newPage()
   await page.clock.install()
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/groups`)
   await page.getByRole('status').filter({ hasText: 'Préparation des données' }).waitFor()
   await page.clock.runFor(61000)
   await page.getByRole('alert').filter({ hasText: 'La préparation des données prend trop de temps' }).waitFor()
   await page.getByRole('button', { name: 'Réessayer', exact: true }).waitFor()
   assert.equal(await page.locator('[role="status"]').count(), 0)
   await context.close()
})

test('a deployed update automatically reloads both tabs and retains offline edits', { timeout: 90000 }, async t => {
   const updated = await mkdtemp(join(tmpdir(), 'offline-auto-update-'))
   let browser, server
   t.after(async () => {
      await browser?.close()
      await server?.close()
      await rm(updated, { recursive: true, force: true })
   })
   await build({
      logLevel: 'error',
      define: { 'import.meta.env.VITE_COUCH_DATABASE_URL': JSON.stringify('/couchdb/offline') },
      build: { outDir: updated, emptyOutDir: true },
      plugins: [{
         name: 'update-test-version',
         transformIndexHtml: html => html.replace('</head>', '<meta name="update-test-version" content="2"></head>'),
      }],
      worker: { plugins: () => [{ name: 'update-test-worker', transform(code, id) {
         // Exercise replacing the shared worker script as well as the page.
         if (id.split('?')[0].endsWith('/src/pgcouch.worker.ts')) return `${code}\nself.__updateTestVersion = 2\n`
      } }] },
   })
   const original = new URL('../dist', import.meta.url).pathname
   let port = 0
   const start = outDir => preview({
      logLevel: 'error', build: { outDir },
      preview: { host: '127.0.0.1', port, strictPort: true, proxy: {} },
      plugins: [{ name: 'unavailable-remote', configurePreviewServer(server) {
         server.middlewares.use('/couchdb/', (_req, res) => {
            res.statusCode = 401; res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'unauthorized', reason: 'Test offline edits' }))
         })
      } }],
   })
   server = await start(original)
   port = server.httpServer.address().port
   const origin = `http://127.0.0.1:${port}`
   browser = await chromium.launch({ headless: true })
   const context = await browser.newContext()
   const first = await context.newPage()
   first.setDefaultTimeout(25000)
   await first.goto(`${origin}/groups`)
   await first.evaluate(() => navigator.serviceWorker.ready.then(() => true))
   await first.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
   const html = await readFile(join(original, 'index.html'), 'utf8')
   const mainPath = html.match(/src="([^"]+\.js)"/)[1]
   const bundle = await readFile(join(original, mainPath), 'utf8')
   const workerPath = bundle.match(/\/assets\/pgcouch\.worker-[^" ]+\.js/)[0]
   const storage = await storageForRemote('/couchdb/offline', origin)
   await attachProbe(first, workerPath, storage.worker)
   await first.evaluate(() => window.syncRequest({ type: 'network', args: [false] }))
   await first.evaluate(() => window.modelCall('group', 'create', [{ uid: 'pending-update', name: 'Saved before update' }]))
   await first.getByText('Saved before update', { exact: true }).waitFor()
   const second = await context.newPage()
   second.setDefaultTimeout(25000)
   await second.goto(`${origin}/groups`)
   await second.getByText('Saved before update', { exact: true }).waitFor()
   await second.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
   await first.locator('input').first().focus()

   // Publish another build at the same origin. The ten-second poll must find it
   // and reload both clients without a click or registration.update() from us.
   await server.close()
   server = await start(updated)
   // The idle tab activates the update; a focused field in another tab must
   // still defer that tab's reload until editing has ended.
   await second.waitForFunction(() => document.querySelector('meta[name="update-test-version"]')?.getAttribute('content') === '2', {}, { timeout: 30000 })
   assert.equal(await first.locator('meta[name="update-test-version"]').count(), 0)
   await first.getByRole('status').filter({ hasText: 'Mise à jour après la saisie' }).waitFor()
   await first.locator('input').first().evaluate(element => element.blur())
   for (const page of [first, second]) {
      try {
         await page.waitForFunction(() => document.querySelector('meta[name="update-test-version"]')?.getAttribute('content') === '2', {}, { timeout: 30000 })
      } catch (error) {
         t.diagnostic(JSON.stringify(await page.evaluate(async () => {
            const r = await navigator.serviceWorker.getRegistration()
            return { text: document.body.innerText, focus: document.activeElement?.tagName,
               active: r?.active?.state, waiting: r?.waiting?.state, installing: r?.installing?.state }
         })))
         throw error
      }
      await page.getByText('Saved before update', { exact: true }).waitFor()
   }
   const nextHtml = await readFile(join(updated, 'index.html'), 'utf8')
   const nextMain = nextHtml.match(/src="([^"]+\.js)"/)[1]
   const nextBundle = await readFile(join(updated, nextMain), 'utf8')
   const nextWorker = nextBundle.match(/\/assets\/pgcouch\.worker-[^" ]+\.js/)[0]
   assert.notEqual(nextWorker, workerPath)
   await attachProbe(first, nextWorker, storage.worker)
   assert.equal((await first.evaluate(() => window.modelCall('group', 'getStatus'))).pending, 1)
   await context.close()
})
