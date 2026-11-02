import test from 'node:test'
import assert from 'node:assert/strict'
import { validateUserMutation } from '../src/validateUser.js'

test('user mutations reject invalid emails and accept valid edits', () => {
   for (const email of ['', null, undefined, 'invalid', 'a@']) {
      for (const action of ['create', 'update']) {
         assert.throws(() => validateUserMutation({ args: ['uid', { email }] }, action),
            error => error.code === 'invalid-argument')
      }
   }
   assert.throws(() => validateUserMutation({ args: ['uid', {}] }, 'create'))
   assert.doesNotThrow(() => validateUserMutation({ args: ['uid', { email: 'alice@example.com' }] }, 'create'))
   assert.doesNotThrow(() => validateUserMutation({ args: ['uid', { email: 'alice@example.com' }] }, 'update'))
   assert.doesNotThrow(() => validateUserMutation({ args: ['uid', { firstname: 'Alice' }] }, 'update'))
})
