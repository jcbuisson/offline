import assert from 'node:assert/strict'
import { electricSqlClientPlugin } from '@jcbuisson/express-x-plugins/electric-sql-client'
const app = { service: () => ({ query: async () => [] }) }
electricSqlClientPlugin(app)
for (const method of ['query', 'watch', 'dispose']) assert.equal(typeof app.sql[method], 'function')
app.sql.dispose()
console.log('SQL plugin API verified')
