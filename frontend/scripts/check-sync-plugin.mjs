import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { electricClientPlugin } from '@jcbuisson/express-x-plugins/electric-client'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.resolve('@jcbuisson/express-x-plugins/electric-client')), 'utf8'))
const [major, minor, patch] = version.split('.').map(Number)
assert.ok(
   major > 5 || major === 5 && (minor > 1 || minor === 1 && patch >= 2),
   'Installed express-x-plugins lacks shared query observables (requires 5.1.2+). Reinstall frontend dependencies.',
)

// Older plugin installations silently ignore sync: true and return online-only
// models. Catch that mismatch before producing a deployable bundle.
const app = {}
electricClientPlugin(app, {
   sync: true,
   databaseName: 'build-check',
   locks: { request() {} },
   BroadcastChannel: class {},
})
assert.equal(
   typeof app.disposeElectricSync,
   'function',
   'Installed express-x-plugins lacks managed sync. Reinstall frontend dependencies before building.',
)
await app.disposeElectricSync()
console.log('Managed Electric sync API verified')
