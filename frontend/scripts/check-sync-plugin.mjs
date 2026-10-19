import assert from 'node:assert/strict'
import { electricClientPlugin } from '@jcbuisson/express-x-plugins/electric-client'

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
