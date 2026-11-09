import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

// Exercise the actual bundled SharedWorker, PGlite, PouchDB and Vue lists.
// Use a fresh browser profile and disable proxies so no production data is touched.
test('production tabs share offline data and survive closing the first tab', { timeout: 60000 }, async t => {
   let browser
   const server = await preview({ preview: { host: '127.0.0.1', port: 0, proxy: {} } })
   t.after(async () => {
      await browser?.close()
      await server.close()
   })
   browser = await chromium.launch({ headless: true })
   const context = await browser.newContext()
   const origin = `http://127.0.0.1:${server.httpServer.address().port}`
   const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8')
   const mainPath = html.match(/src="([^"]+\.js)"/)[1]
   const bundle = await readFile(new URL(`../dist${mainPath}`, import.meta.url), 'utf8')
   const workerPath = bundle.match(/\/assets\/pgcouch\.worker-[^" ]+\.js/)[0]
   const errors = []
   context.on('page', page => {
      page.setDefaultTimeout(15000)
      page.on('pageerror', error => errors.push(error.message))
   })
   async function attach(page) {
      await page.evaluate(path => {
         // Attach a test port to the same worker used by the UI.
         const worker = new SharedWorker(path, { type: 'module', name: 'offline-pgcouch' })
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
      }, workerPath)
   }
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
   assert.deepEqual(errors, [])
   await context.close()
})
