import assert from 'node:assert/strict'
import { pgcouchClientPlugin } from '@jcbuisson/express-x-plugins/pgcouch-client'
assert.equal(typeof pgcouchClientPlugin, 'function')
console.log('PGCouch client API verified')
